// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IPVSCollector.sol";

contract Collector is Ownable {
    using SafeERC20 for IERC20;

    // The Token for Collect
    address public pvsAddress;

    // official address for celer bridge
    address public cbridgeAddress;

    // address for multichain 
    address public multichainAddress;

    // The total amount of cross-chain tokens
    uint256 public totalCross;

    constructor(address _pvsAddress, address _cbridgeAddress) {
        pvsAddress = _pvsAddress;
        cbridgeAddress = _cbridgeAddress;
    }

    function cbridgeSend(
        address _receiver,
        uint256 _amount,
        uint64 _dstChainId,
        uint64 _nonce,                  //timestamp
        uint32 _maxSlippage
    ) external onlyOwner {
        IPVSCollector(cbridgeAddress).send(
            _receiver,
            pvsAddress,
            _amount,
            _dstChainId,
            _nonce,
            _maxSlippage
        );
        totalCross += _amount;
    }

    function multichainSend(
        address _destination,
        string calldata _msg,
        address _fallback, 
        uint256 _toChainID
    ) external onlyOwner {
        IPVSCollector(multichainAddress).anyCall(
            _destination,
            abi.encodeWithSignature("step2_createMsg(string)" ,_msg),
            _fallback,
            _toChainID
        );
    }
}
