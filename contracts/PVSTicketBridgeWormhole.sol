// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./wormhole/IWormhole.sol";

interface IMintableBurnable {
    function mint(address to, uint256 amount) external;

    function burn(address from, uint256 amount) external;
}

contract PVSTicketBridge is Ownable {
    // Address of PVST token
    address ticketAddress;

    // Wormhole core contract address
    address wormholeAddress;

    // The backend who checks the VAA and send the transaction
    address verifier;

    address payable nativeTokenReceiver;

    uint256 minSend;
    uint256 maxSend;

    mapping(uint64 => uint256) dstChainGasAmount;

    mapping(address => uint256) lastSendTimestamp;

    mapping(uint256 => bool) sendOutRecord;
    mapping(uint256 => uint256) sendInRecord;

    event SendOut(
        uint256 indexed transferId,
        address indexed sender,
        address indexed receiver,
        uint256 amount,
        uint64 dstChainId,
        uint64 nonce
    );

    event SendIn(
        uint256 indexed transferId,
        address indexed sender,
        address indexed receiver,
        uint256 amount,
        uint64 srcChainId,
        uint64 nonce
    );

    modifier onlyVerifier() {
        require(
            msg.sender == verifier,
            "PVSTicketBridgeWormhole: onlyVerifier"
        );
        _;
    }

    constructor(address _wormholeAddress, address _verifier) {
        wormholeAddress = _wormholeAddress;
        verifier = _verifier;
    }

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

    /**
     * Transfer PVST tokens from another chain to the current chain.
     * Only verifier can call this function.
     */
    function sendIn(
        uint256 _transferId,
        address _sender,
        address _receiver,
        uint256 _amount,
        uint64 _srcChainId,
        uint64 _nonce
    ) external onlyVerifier {
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
            "PVSTicketBridgeWormhole: wrong transferId"
        );

        IMintableBurnable(ticketAddress).mint(_receiver, _amount);

        emit SendIn(
            _transferId,
            _sender,
            _receiver,
            _amount,
            _srcChainId,
            _nonce
        );
    }

    /**
     * Transfer PVST tokens from the current chain to another EVM-compatible chain.
     * Everyone who wants to send tokens cross chains calls this function.
     */
    function sendOut(
        address _receiver,
        uint256 _amount,
        uint64 _dstChainId,
        uint64 _nonce
    ) external payable {
        // User should not be sending cross-chain requests too often.
        require(
            block.timestamp > lastSendTimestamp[msg.sender] + 12 hours,
            "PVSTicketBridgeWormhole: wait a minute"
        );

        lastSendTimestamp[msg.sender] = block.timestamp;

        // Calculate transfer id
        uint256 transferId = _checkTransfer(
            _receiver,
            _amount,
            _dstChainId,
            _nonce
        );

        IMintableBurnable(ticketAddress).burn(msg.sender, _amount);

        if (dstChainGasAmount[_dstChainId] > 0) {
            (bool sent, ) = nativeTokenReceiver.call{value: msg.value}("");
            require(sent, "PVSTicketBridgeWormhole: failed to send tokens");
        }

        bytes memory infoBytes = abi.encode(
            transferId,
            msg.sender,
            _receiver,
            _amount,
            _dstChainId,
            _nonce
        );

        _sendBytes(infoBytes, uint32(transferId));

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
    ) internal returns (uint256) {
        require(
            _amount >= minSend,
            "PVSTicketBridgeWormhole: amount too small"
        );
        require(
            maxSend == 0 || _amount <= maxSend,
            "PVSTicketBridgeWormhole: amount too large"
        );

        uint256 transferId = _calculateTransferId(
            msg.sender,
            _receiver,
            _amount,
            uint64(block.chainid),
            _dstChainId,
            _nonce
        );

        require(
            sendOutRecord[transferId] == false,
            "PVSTicketBridgeWormhole: transfer exists"
        );
        sendOutRecord[transferId] = true;

        return transferId;
    }

    /**
     * Send bytes using wormhole's core contract
     */
    function _sendBytes(bytes memory str, uint32 nonce)
        internal
        returns (uint64 sequence)
    {
        sequence = IWormhole(wormholeAddress).publishMessage(nonce, str, 1);
        return sequence;
    }

    function _calculateTransferId(
        address _sender,
        address _receiver,
        uint256 _amount,
        uint64 _srcChainId,
        uint64 _dstChainId,
        uint256 _nonce
    ) internal pure returns (uint256) {
        return
            uint256(
                keccak256(
                    abi.encodePacked(
                        _sender,
                        _receiver,
                        _amount,
                        _srcChainId,
                        _dstChainId,
                        _nonce
                    )
                )
            );
    }
}
