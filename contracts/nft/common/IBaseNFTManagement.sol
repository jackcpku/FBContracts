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
     * @dev Set the tokenURI of a certain NFT.
     * @param tokenId The target NFT.
     * @param tokenURI Metauri to be set.
     */
    function setTokenURI(uint256 tokenId, string memory tokenURI) external;

    /**
     * @dev Mint an NFT to the given address.
     * @notice Only gateway contract is authorized to mint.
     * @param recipient The recipient of the minted NFT.
     * @param tokenURI The tokenURI associated with the NFT.
     */
    function mint(address recipient, string memory tokenURI) external;
}
