// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC721Gateway {
    /********************************************************************
     *                        ERC721 interfaces                         *
     ********************************************************************/

    /**
     * @dev Mint an ERC721 token to the given address.
     * @notice Only gateway contract is authorized to mint.
     * @param recipient The recipient of the minted NFT.
     * @param tokenId The tokenId to be minted.
     */
    function ERC721_mint(
        address nftContract,
        address recipient,
        uint256 tokenId
    ) external;

    /**
     * @dev Burn an ERC721 token.
     * @notice Only gateway contract can burn.
     * @param tokenId The tokenId to be burned.
     */
    function ERC721_burn(address nftContract, uint256 tokenId) external;

    /**
     * @dev Set `baseURI` of the ERC721 token. If set, the resulting URI for each
     * token will be the concatenation of the `baseURI` and the `tokenId`.
     */
    function ERC721_setURI(address nftContract, string memory newURI) external;
}
