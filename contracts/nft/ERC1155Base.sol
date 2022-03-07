// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./common/BaseNFTManagement.sol";
import "./common/ERC1155MintableBurnable.sol";

contract ERC1155Base is ERC1155MintableBurnable, BaseNFTManagement {
    /**
     * @param _gateway NFTGateway contract of the NFT contract.
     */
    constructor(string memory _uri, address _gateway)
        ERC1155MintableBurnable(_uri)
        BaseNFTManagement(_gateway)
    {}
}
