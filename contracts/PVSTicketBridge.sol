// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./MultisigWallet.sol";

interface IMintableBurnable {
    function mint(address to, uint256 amount) external;

    function burn(address from, uint256 amount) external;
}

contract PVSTicketBridge is Ownable, MultisigWallet {
    address ticketAddress;

    address payable nativeTokenReceiver;

    uint256 minSend;
    uint256 maxSend;

    mapping(uint64 => uint256) dstChainGasAmount;

    mapping(address => uint256) lastSendTimestamp;

    mapping(bytes32 => bool) sendOutRecord;
    mapping(bytes32 => uint256) sendInRecord;

    event SendOut(
        bytes32 indexed transferId,
        address indexed sender,
        address indexed receiver,
        uint256 amount,
        uint64 dstChainId,
        uint64 nonce
    );

    event SendIn(
        bytes32 indexed transferId,
        address indexed sender,
        address indexed receiver,
        uint256 amount,
        uint64 srcChainId,
        uint64 nonce
    );

    constructor(
        uint256 m,
        uint256 n,
        address[] memory signers
    ) Ownable() MultisigWallet(m, n, signers) {}

    function setDstChainGasAmount(uint64 _dstChainId, uint256 _gasAmount)
        external
        onlyOwner
    {
        dstChainGasAmount[_dstChainId] = _gasAmount;
    }

    function setNativeTokenReceiver(address payable _nativeTokenReceiver)
        external
        onlyOwner
    {
        nativeTokenReceiver = _nativeTokenReceiver;
    }

    function setSendThreshold(uint256 _minSend, uint256 _maxSend)
        external
        onlyOwner
    {
        minSend = _minSend;
        maxSend = _maxSend;
    }

    function sendIn(
        bytes32 _transferId,
        address _sender,
        address _receiver,
        uint256 _amount,
        uint64 _srcChainId,
        uint64 _nonce
    ) external {
        require(
            _transferId ==
                _calculateTransferId(
                    _sender,
                    _receiver,
                    _amount,
                    _srcChainId,
                    uint64(block.chainid),
                    _nonce
                ),
            "PVSTicketBridge: wrong transferId"
        );

        guardedMint(_transferId, _receiver, _amount);
    }

    function guardedMint(
        bytes32 _transferId,
        address _receiver,
        uint256 _amount
    ) internal onlyMultisigWalletSigner(_transferId) {
        IMintableBurnable(ticketAddress).mint(_receiver, _amount);
    }

    function sendOut(
        address _receiver,
        uint256 _amount,
        uint64 _dstChainId,
        uint64 _nonce
    ) external payable {
        require(
            block.timestamp > lastSendTimestamp[msg.sender] + 12 hours,
            "PVSTicketBridge: wait a minute"
        );

        lastSendTimestamp[msg.sender] = block.timestamp;

        bytes32 transferId = _checkTransfer(
            _receiver,
            _amount,
            _dstChainId,
            _nonce
        );

        IMintableBurnable(ticketAddress).burn(msg.sender, _amount);

        if (dstChainGasAmount[_dstChainId] > 0) {
            (bool sent, ) = nativeTokenReceiver.call{value: msg.value}("");
            require(sent, "PVSTicketBridge: failed to send tokens");
        }

        emit SendOut(
            transferId,
            msg.sender,
            _receiver,
            _amount,
            _dstChainId,
            _nonce
        );
    }

    function _checkTransfer(
        address _receiver,
        uint256 _amount,
        uint64 _dstChainId,
        uint64 _nonce
    ) internal returns (bytes32) {
        require(_amount > minSend, "PVSTicketBridge: amount too small");
        require(
            maxSend == 0 || _amount <= maxSend,
            "PVSTicketBridge: amount too large"
        );

        bytes32 transferId = _calculateTransferId(
            msg.sender,
            _receiver,
            _amount,
            uint64(block.chainid),
            _dstChainId,
            _nonce
        );

        require(
            sendOutRecord[transferId] == false,
            "PVSTicketBridge: transfer exists"
        );
        sendOutRecord[transferId] = true;

        return transferId;
    }

    function _calculateTransferId(
        address _sender,
        address _receiver,
        uint256 _amount,
        uint64 _srcChainId,
        uint64 _dstChainId,
        uint256 _nonce
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _sender,
                    _receiver,
                    _amount,
                    _srcChainId,
                    _dstChainId,
                    _nonce
                )
            );
    }
}
