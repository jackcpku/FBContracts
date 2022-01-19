// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../NFTContracts/BasicERC721.sol";
import "./Gateway.sol";

import "hardhat/console.sol";

contract Factory is Initializable {
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
    function deployBasicERC721(string memory _name, string memory _symbol)
        public
        returns (address deployedAddress)
    {
        // Deploy the contract and set its gateway.
        deployedAddress = address(
            new BasicERC721(_name, _symbol, gatewayAddress)
        );

        emit ContractDeployed(msg.sender, deployedAddress);

        // Set manager of the newly deployed contract.
        Gateway(gatewayAddress).setManagerOf(deployedAddress, msg.sender);
    }
}
