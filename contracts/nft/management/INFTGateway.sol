// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

interface INFTGateway {
    /**
     * Query the current manager of the given NFT contract.
     */
    function nftManager(address _nftContract) external returns (address);

    /**
     * @dev Check if address `_x` is in management.
     * @notice If `_x` is the previous manager and the grace period has not
     * passed, still returns true.
     */
    function isInManagement(address _x, address _nftContract)
        external
        view
        returns (bool);
}
