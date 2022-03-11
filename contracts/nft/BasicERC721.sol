// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "./management/BaseNFTManagement.sol";

contract BasicERC721 is ERC721, ERC721Burnable, BaseNFTManagement {
    string private __baseURI;

    /**
     * @param gateway NFTGateway contract of the NFT contract.
     */
    constructor(
        string memory name,
        string memory symbol,
        string memory baseURI,
        address gateway
    ) ERC721(name, symbol) BaseNFTManagement(gateway) {
        __baseURI = baseURI;
    }

    function mint(address to, uint256 tokenId) external onlyGateway {
        _safeMint(to, tokenId);
    }

    function burn(uint256 tokenId) public override onlyGateway {
        super.burn(tokenId);
    }

    function setURI(string calldata newBaseURI) external onlyGateway {
        __baseURI = newBaseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return __baseURI;
    }
}
