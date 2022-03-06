// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../nft/common/ERC1155MintableBurnable.sol";

contract SomeERC1155 is ERC1155MintableBurnable {
    constructor(string memory uri_) ERC1155MintableBurnable(uri_) {}
}
