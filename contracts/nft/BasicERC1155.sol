// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "./management/BaseNFTManagement.sol";

contract BasicERC1155 is
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
        bytes memory data
    ) external onlyGateway {
        _mint(account, id, amount, data);
    }

    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) external onlyGateway {
        _mintBatch(to, ids, amounts, data);
    }

    function burn(
        address account,
        uint256 id,
        uint256 value
    ) public override onlyGateway {
        super.burn(account, id, value);
    }

    function burnBatch(
        address account,
        uint256[] memory ids,
        uint256[] memory values
    ) public override onlyGateway {
        super.burnBatch(account, ids, values);
    }

    function setURI(string memory newuri) external onlyGateway {
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
}
