// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "./management/BaseNFTManagement.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract BasicERC721 is ERC721, ERC721Burnable, BaseNFTManagement {
    using Strings for uint256;

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

    function mintBatch(address[] calldata to, uint256[] calldata tokenId)
        external
        onlyGateway
    {
        require(
            to.length == tokenId.length,
            "BasicERC721: bad parameter length"
        );

        for (uint256 i = 0; i < to.length; i++) {
            _safeMint(to[i], tokenId[i]);
        }
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        return string(abi.encodePacked(__baseURI, tokenId.toHexString(32)));
    }

    function setURI(string calldata newBaseURI) external onlyGateway {
        __baseURI = newBaseURI;
    }
}
