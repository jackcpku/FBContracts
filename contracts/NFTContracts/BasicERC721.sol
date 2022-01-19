// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "../common/BaseNFTManagement.sol";
import "../common/MostBaseERC721.sol";

contract BasicERC721 is MostBaseERC721, BaseNFTManagement {
    /**
     * @param _gateway Gateway contract of the NFT contract.
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _gateway
    ) MostBaseERC721(_name, _symbol) BaseNFTManagement(_gateway) {}

    /**
     * @inheritdoc IBaseNFTManagement
     */
    function setGateway(address _gateway) external override onlyGateway {
        gateway = _gateway;
    }

    /**
     * @inheritdoc IBaseNFTManagement
     */
    function setTokenURI(uint256 tokenId, string memory tokenURI)
        external
        override
        onlyGateway
    {
        _setTokenURI(tokenId, tokenURI);
    }

    /**
     * @inheritdoc IBaseNFTManagement
     */
    function mint(address recipient, string memory tokenURI)
        external
        override
        onlyGateway
    {
        safeMint(recipient, tokenURI);
    }
}
