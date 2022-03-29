// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "./management/BaseNFTManagement.sol";
import "./interfaces/INFTGateway.sol";
import "./interfaces/IBasicERC1155.sol";

contract BasicERC1155 is
    IBasicERC1155,
    ERC1155,
    ERC1155Burnable,
    ERC1155Supply,
    BaseNFTManagement
{
    /**
     * @param _gateway NFTGateway contract of the NFT contract.
     */
    constructor(string memory _uri, address _gateway)
        ERC1155(_uri)
        BaseNFTManagement(_gateway)
    {}

    function mint(
        address account,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external override onlyGateway {
        _mint(account, id, amount, data);
    }

    function mintBatch(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external override onlyGateway {
        _mintBatch(to, ids, amounts, data);
    }

    function setURI(string calldata newuri) external override onlyGateway {
        _setURI(newuri);
    }

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override(ERC1155, ERC1155Supply) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function isApprovedForAll(address account, address operator)
        public
        view
        override
        returns (bool)
    {
        if (INFTGateway(gateway).operatorWhitelist(operator)) {
            return true;
        }
        return super.isApprovedForAll(account, operator);
    }
}
