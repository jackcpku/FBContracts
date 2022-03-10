// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "./management/BaseNFTManagement.sol";

contract BasicERC721 is ERC721, ERC721Burnable, BaseNFTManagement {
    string private __baseURI;

    /**
     * @param _gateway NFTGateway contract of the NFT contract.
     */
    constructor(
        string memory _name,
        string memory _symbol,
        string memory _baseURI,
        address _gateway
    ) ERC721(_name, _symbol) BaseNFTManagement(_gateway) {
        __baseURI = _baseURI;
    }

    function mint(address to, uint256 tokenId) external onlyGateway {
        _safeMint(to, tokenId);
    }

    function setURI(string memory newBaseURI) external onlyGateway {
        __baseURI = newBaseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return __baseURI;
    }
}
