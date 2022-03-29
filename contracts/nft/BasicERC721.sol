// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "./management/BaseNFTManagement.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/INFTGateway.sol";
import "./interfaces/IBasicERC721.sol";

contract BasicERC721 is
    IBasicERC721,
    ERC721,
    ERC721Burnable,
    BaseNFTManagement
{
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

    function mint(address to, uint256 tokenId) external override onlyGateway {
        _safeMint(to, tokenId);
    }

    function mintBatch(address to, uint256[] calldata tokenId)
        external
        override
        onlyGateway
    {
        for (uint256 i = 0; i < tokenId.length; i++) {
            _safeMint(to, tokenId[i]);
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

    function setURI(string calldata newBaseURI) external override onlyGateway {
        __baseURI = newBaseURI;
    }

    function isApprovedForAll(address owner, address operator)
        public
        view
        override
        returns (bool)
    {
        if (INFTGateway(gateway).operatorWhitelist(operator)) {
            return true;
        }
        return super.isApprovedForAll(owner, operator);
    }
}
