// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @dev Interface of the PVS Collect and Cross-Chain.
 */
interface IPVSCollector {
    /**
     * celer-bridge interface
     *
     * @notice Send a cross-chain transfer via the liquidity pool-based bridge.
     * NOTE: This function DOES NOT SUPPORT fee-on-transfer / rebasing tokens.
     * @param _receiver The address of the receiver.
     * @param _token The address of the token.
     * @param _amount The amount of the transfer.
     * @param _dstChainId The destination chain ID.
     * @param _nonce A number input to guarantee uniqueness of transferId. Can be timestamp in practice.
     * @param _maxSlippage The max slippage accepted, given as percentage in point (pip). Eg. 5000 means 0.5%.
     * Must be greater than minimalMaxSlippage. Receiver is guaranteed to receive at least (100% - max slippage percentage) * amount or the
     * transfer can be refunded.
     */
    function send(
        address _receiver,
        address _token,
        uint256 _amount,
        uint64 _dstChainId,
        uint64 _nonce,
        uint32 _maxSlippage // slippage * 1M, eg. 0.5% -> 5000
    ) external;

    /**
     * multichain interface
     * @param _to The destination contract address on target chain
     * @param _data The abi.encodeWithSignature bytes data of the destination contract function
     * @param _fallback The fallback contract on the SOURCE CHAIN if the destination chain contract execution failed.
     * @param _toChainID The destination chain ID
     */
    function anyCall(
        address _to,
        bytes calldata _data,
        address _fallback, //if no use address(0)
        uint256 _toChainID
    ) external;
}
