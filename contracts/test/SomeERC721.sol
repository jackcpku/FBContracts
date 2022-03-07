// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../nft/common/ERC721MintableBurnable.sol";

/**
 * A test NFT contract that doesn't use gateway logic.
 */
contract SomeERC721 is ERC721MintableBurnable {
    constructor(string memory _name, string memory _symbol)
        ERC721MintableBurnable(_name, _symbol)
    {}
}
