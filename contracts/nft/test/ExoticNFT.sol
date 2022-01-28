// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "../common/MostBaseERC721.sol";

/**
 * A test NFT contract that doesn't use gateway logic.
 */
contract ExoticNFT is MostBaseERC721 {
    constructor(string memory _name, string memory _symbol)
        MostBaseERC721(_name, _symbol)
    {}

    function setTokenURI(uint256 tokenId, string memory tokenURI) external {
        _setTokenURI(tokenId, tokenURI);
    }

    function mint(address recipient, string memory tokenURI) external {
        safeMint(recipient, tokenURI);
    }
}
