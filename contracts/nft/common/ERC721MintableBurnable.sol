// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";

contract ERC721MintableBurnable is ERC721, ERC721Burnable {
    constructor(string memory name, string memory symbol)
        ERC721(name, symbol)
    {}

    string private __baseURI;

    function mint(address to, uint256 tokenId) public {
        _safeMint(to, tokenId);
    }

    function burn(uint256 tokenId) public override {
        super.burn(tokenId);
    }

    function setURI(string memory newBaseURI) external {
        __baseURI = newBaseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return __baseURI;
    }
}
