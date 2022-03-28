// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract LootBox {
    mapping(uint256 => bool[2 * 2000]) trees;
    uint256 current;

    event GetRandomIndex(uint256 indexed current, uint256 indexed random);

    event Full(address indexed sender);

    /**
     * Get a random number in range of [1, 2000].
     * One number can only be picked up once. If all 2000 numbers are
     * taken, return 0.
     */
    function getRandom() external returns (uint256 result) {
        if (trees[current][0]) {
            emit Full(msg.sender);
            return 0;
        }

        uint256 rand = uint256(
            keccak256(abi.encodePacked(msg.sender, block.timestamp))
        );

        uint256 currentNode = 0;
        while (inTree(getLeftChild(currentNode))) {
            // When currentNode's left child is in tree, node is an internal node.

            // If one and only one of children nodes is empty, go the empty path.
            if (queryNode(getLeftChild(currentNode))) {
                currentNode = getRightChild(currentNode);
                continue;
            } else if (queryNode(getRightChild(currentNode))) {
                currentNode = getLeftChild(currentNode);
                continue;
            }

            // If both children nodes are empty, roll a dice
            if (rand % 2 == 0) {
                currentNode = getLeftChild(currentNode);
            } else {
                currentNode = getRightChild(currentNode);
            }
            rand = rand / 2;
        }

        // At this point, currentNode is an empty leaf node.
        assert(!queryNode(currentNode));

        setNode(currentNode);
        result = currentNode + 2 - 2000;

        emit GetRandomIndex(current, result);

        // Traverse back to root
        while (queryNode(getBrother(currentNode)) && currentNode != 0) {
            currentNode = getParent(currentNode);
            setNode(currentNode);
        }
    }

    function setNode(uint256 currentNode) internal {
        trees[current][currentNode] = true;
    }

    function queryNode(uint256 currentNode) internal view returns (bool) {
        return trees[current][currentNode];
    }

    function getBrother(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        else if (x % 2 == 0) return x - 1;
        else return x + 1;
    }

    function getParent(uint256 x) internal pure returns (uint256) {
        return (x - 1) / 2;
    }

    function getLeftChild(uint256 x) internal pure returns (uint256) {
        return 2 * x + 1;
    }

    function getRightChild(uint256 x) internal pure returns (uint256) {
        return 2 * x + 2;
    }

    function inTree(uint256 x) internal pure returns (bool) {
        return x <= 2 * (2000 - 1);
    }
}
