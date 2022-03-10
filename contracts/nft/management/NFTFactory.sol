// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../BasicERC721.sol";
import "../BasicERC1155.sol";
import "./NFTGateway.sol";

contract NFTFactory is Initializable {
    address public gatewayAddress;

    event ContractDeployed(
        address indexed deployer,
        address indexed deployedAddress
    );

    function initialize(address _gatewayAddress) public initializer {
        gatewayAddress = _gatewayAddress;
    }

    /**
     * Deploy a BasicERC721 contract.
     */
    function deployBaseERC721(
        string calldata _name,
        string calldata _symbol,
        uint256 _salt
    ) external returns (address deployedAddress) {
        // Deploy the contract and set its gateway.
        deployedAddress = address(
            new BasicERC721{salt: bytes32(_salt)}(
                _name,
                _symbol,
                gatewayAddress
            )
        );

        emit ContractDeployed(msg.sender, deployedAddress);

        // Set manager of the newly deployed contract.
        NFTGateway(gatewayAddress).setManagerOf(deployedAddress, msg.sender);
    }

    /**
     * Deploy a BasicERC1155 contract.
     */
    function deployBaseERC1155(string calldata _uri, uint256 _salt)
        external
        returns (address deployedAddress)
    {
        // Deploy the contract and set its gateway.
        deployedAddress = address(
            new BasicERC1155{salt: bytes32(_salt)}(_uri, gatewayAddress)
        );

        emit ContractDeployed(msg.sender, deployedAddress);

        // Set manager of the newly deployed contract.
        NFTGateway(gatewayAddress).setManagerOf(deployedAddress, msg.sender);
    }
}
