// SPDX-License-Identifier: Unlicensed
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
     * @dev Set the metauri of a certain NFT.
     * @param tokenId The target NFT.
     * @param metaUri Metauri to be set.
     */
    function setMetaUri(uint256 tokenId, string memory metaUri) external;

    /**
     * @dev Mint an NFT to the given address.
     * @notice Only gateway contract is authorized to mint.
     * @param recipient The recipient of the minted NFT.
     * @param metaUri The metauri associated with the NFT.
     */
    function mint(address recipient, string memory metaUri) external;

    function getGateway() external view returns (address gateway);

    function getMetaUri(uint256 tokenId)
        external
        view
        returns (string memory metaUri);
}
