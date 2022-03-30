// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/INFTGateway.sol";

interface IERC1155BurnSingle {
    function burn(
        address account,
        uint256 id,
        uint256 value
    ) external;
}

contract SimpleLootBoxRegistry is Ownable {
    address nftGateway;

    /**
     * erc1155TokenAddress => erc1155TokenId => tree
     */
    mapping(address => mapping(uint256 => bool[])) trees;

    /**
     * Number of items in the given lootbox
     *
     * erc1155TokenAddress => erc1155TokenId => size
     */
    mapping(address => mapping(uint256 => uint256)) erc721Sizes;

    /**
     * erc1155TokenAddress => erc1155TokenId => erc721LowerBounds
     */
    mapping(address => mapping(uint256 => uint256)) erc721LowerBounds;

    /**
     * erc1155TokenAddress => erc1155TokenId => erc721Address
     */
    mapping(address => mapping(uint256 => address)) erc721TokenAddresses;

    event ConfigLootBox(
        address indexed erc1155TokenAddress,
        uint256 indexed erc1155TokenId,
        address indexed erc721TokenAddress,
        uint256 erc721LowerBound,
        uint256 erc721UpperBound
    );

    event UnwrapLootBox(
        address erc1155TokenAddress,
        uint256 erc1155TokenId,
        address indexed erc721TokenAddress,
        uint256 indexed erc721TokenId
    );

    constructor(address _nftGateway) {
        nftGateway = _nftGateway;
    }

    // boxNFT & contentNFT
    function configLootBox(
        address _erc721TokenAddress,
        uint256 _erc721LowerBound,
        uint256 _erc721UpperBound,
        address _erc1155TokenAddress,
        uint256 _erc1155TokenId
    ) external onlyOwner {
        require(
            erc721Sizes[_erc1155TokenAddress][_erc1155TokenId] == 0,
            "SimpleLootBoxRegistry: erc1155 already used"
        );

        trees[_erc1155TokenAddress][_erc1155TokenId] = new bool[](
            2 * (_erc721UpperBound - _erc721LowerBound + 1) - 1
        );
        erc721LowerBounds[_erc1155TokenAddress][
            _erc1155TokenId
        ] = _erc721LowerBound;
        erc721Sizes[_erc1155TokenAddress][
            _erc1155TokenId
        ] = (_erc721UpperBound - _erc721LowerBound + 1);
        erc721TokenAddresses[_erc1155TokenAddress][
            _erc1155TokenId
        ] = _erc721TokenAddress;

        emit ConfigLootBox(
            _erc1155TokenAddress,
            _erc1155TokenId,
            _erc721TokenAddress,
            _erc721LowerBound,
            _erc721UpperBound
        );
    }

    /**
     * This function
     */
    function unwrapLootBox(
        address _erc1155TokenAddress,
        uint256 _erc1155TokenId
    ) external returns (uint256 randomTokenId) {
        randomTokenId = _getRandom(_erc1155TokenAddress, _erc1155TokenId);
        if (randomTokenId == 0) return 0;

        IERC1155BurnSingle(_erc1155TokenAddress).burn(
            msg.sender,
            _erc1155TokenId,
            1
        );

        // address(this) must be added to NFTGateway's whitelist
        INFTGateway(nftGateway).ERC721_mint(
            erc721TokenAddresses[_erc1155TokenAddress][_erc1155TokenId],
            msg.sender,
            randomTokenId
        );

        emit UnwrapLootBox(
            _erc1155TokenAddress,
            _erc1155TokenId,
            erc721TokenAddresses[_erc1155TokenAddress][_erc1155TokenId],
            randomTokenId
        );
    }

    /**
     * Get a random number in range of [lowerBound, upperBound].
     * One number can only be picked up once. If all 2000 numbers are
     * taken, return 0.
     */
    function _getRandom(address _erc1155TokenAddress, uint256 _erc1155TokenId)
        internal
        returns (uint256 result)
    {
        if (trees[_erc1155TokenAddress][_erc1155TokenId][0]) {
            // No lootbox left.
            return 0;
        }

        uint256 rand = uint256(
            keccak256(abi.encodePacked(msg.sender, block.timestamp))
        );

        uint256 currentNode = 0;
        while (
            _inTree(
                _erc1155TokenAddress,
                _erc1155TokenId,
                _getLeftChild(currentNode)
            )
        ) {
            // When currentNode's left child is in tree, node is an internal node.

            // If one and only one of children nodes is empty, go the empty path.
            if (
                _queryNode(
                    _erc1155TokenAddress,
                    _erc1155TokenId,
                    _getLeftChild(currentNode)
                )
            ) {
                currentNode = _getRightChild(currentNode);
                continue;
            } else if (
                _queryNode(
                    _erc1155TokenAddress,
                    _erc1155TokenId,
                    _getRightChild(currentNode)
                )
            ) {
                currentNode = _getLeftChild(currentNode);
                continue;
            }

            // If both children nodes are empty, roll a dice
            if (rand % 2 == 0) {
                currentNode = _getLeftChild(currentNode);
            } else {
                currentNode = _getRightChild(currentNode);
            }
            rand = rand / 2;
        }

        // At this point, currentNode is an empty leaf node.
        assert(!_queryNode(_erc1155TokenAddress, _erc1155TokenId, currentNode));

        _setNode(_erc1155TokenAddress, _erc1155TokenId, currentNode);
        result =
            currentNode +
            1 -
            erc721Sizes[_erc1155TokenAddress][_erc1155TokenId] +
            erc721LowerBounds[_erc1155TokenAddress][_erc1155TokenId];

        // Traverse back to root
        while (
            _queryNode(
                _erc1155TokenAddress,
                _erc1155TokenId,
                _getBrother(currentNode)
            ) && currentNode != 0
        ) {
            currentNode = _getParent(currentNode);
            _setNode(_erc1155TokenAddress, _erc1155TokenId, currentNode);
        }
    }

    function _setNode(
        address _erc1155TokenAddress,
        uint256 _erc1155TokenId,
        uint256 x
    ) internal {
        trees[_erc1155TokenAddress][_erc1155TokenId][x] = true;
    }

    function _queryNode(
        address _erc1155TokenAddress,
        uint256 _erc1155TokenId,
        uint256 x
    ) internal view returns (bool) {
        return trees[_erc1155TokenAddress][_erc1155TokenId][x];
    }

    function _inTree(
        address _erc1155TokenAddress,
        uint256 _erc1155TokenId,
        uint256 _x
    ) internal view returns (bool) {
        return _x < 2 * erc721Sizes[_erc1155TokenAddress][_erc1155TokenId] - 1;
    }

    function _getBrother(uint256 _x) internal pure returns (uint256) {
        if (_x == 0) return 0;
        else if (_x % 2 == 0) return _x - 1;
        else return _x + 1;
    }

    function _getParent(uint256 _x) internal pure returns (uint256) {
        return (_x - 1) / 2;
    }

    function _getLeftChild(uint256 _x) internal pure returns (uint256) {
        return 2 * _x + 1;
    }

    function _getRightChild(uint256 _x) internal pure returns (uint256) {
        return 2 * _x + 2;
    }
}
