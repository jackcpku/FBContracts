// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC1155Gateway {
    /********************************************************************
     *                        ERC1155 interfaces                        *
     ********************************************************************/

    /**
     * @dev Mint ERC1155 tokens.
     * @param account receiver of the minted tokens
     * @param id id of tokens to be minted
     * @param amount amount of tokens to be minted
     */
    function ERC1155_mint(
        address nftContract,
        address account,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external;

    /**
     * @dev Mint a batch of ERC1155 tokens.
     *
     * See {ERC1155_mint}
     */
    function ERC1155_mintBatch(
        address nftContract,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) external;

    /**
     * @dev Burn ERC1155 tokens.
     * @param account owner of the tokens to be burned
     * @param id the tokenId to be burned
     * @param value the amount to be burned
     */
    function ERC1155_burn(
        address nftContract,
        address account,
        uint256 id,
        uint256 value
    ) external;

    /**
     * @dev Burn a batch of ERC1155 tokens.
     *
     * See {ERC1155_burn}
     */
    function ERC1155_burnBatch(
        address nftContract,
        address account,
        uint256[] memory ids,
        uint256[] memory values
    ) external;

    /**
     * @dev Sets a new URI for all token types, by relying on the token type ID
     * substitution mechanism
     * https://eips.ethereum.org/EIPS/eip-1155#metadata[defined in the EIP].
     *
     * By this mechanism, any occurrence of the `\{id\}` substring in either the
     * URI or any of the amounts in the JSON file at said URI will be replaced by
     * clients with the token type ID.
     *
     * For example, the `https://token-cdn-domain/\{id\}.json` URI would be
     * interpreted by clients as
     * `https://token-cdn-domain/000000000000000000000000000000000000000000000000000000000004cce0.json`
     * for token type ID 0x4cce0.
     *
     * See {uri}.
     *
     * Because these URIs cannot be meaningfully represented by the {URI} event,
     * this function emits no events.
     */
    function ERC1155_setURI(address nftContract, string memory newuri) external;
}
