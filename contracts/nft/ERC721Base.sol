// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./common/BaseNFTManagement.sol";
import "./common/ERC721MintableBurnable.sol";

contract ERC721Base is ERC721MintableBurnable, BaseNFTManagement {
    /**
     * @param _gateway NFTGateway contract of the NFT contract.
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _gateway
    ) ERC721MintableBurnable(_name, _symbol) BaseNFTManagement(_gateway) {}

    /**
     * @inheritdoc IBaseNFTManagement
     */
    function mint(address recipient, uint256 tokenId)
        external
        override
        onlyGateway
    {
        _safeMint(recipient, tokenId);
    }
}
