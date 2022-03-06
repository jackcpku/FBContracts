// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * The management interface exposed to gateway.
 */
interface IBaseNFTManagement {
    /**
     * @dev Set the gateway contract address.
     * @notice Only gateway contract is authorized to set a
     * new gateway address.
     * @notice This function should be rarely used.
     * @param gateway The new gateway address.
     */
    function setGateway(address gateway) external;

    /**
     * @dev Mint an NFT to the given address.
     * @notice Only gateway contract is authorized to mint.
     * @param recipient The recipient of the minted NFT.
     * @param tokenId The tokenId to be minted.
     */
    function mint(address recipient, uint256 tokenId) external;
}
