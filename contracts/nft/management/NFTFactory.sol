// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../BasicERC721.sol";
import "../BasicERC1155.sol";
import "../interfaces/INFTGateway.sol";

contract NFTFactory is Initializable {
    address public gatewayAddress;

    event DeployContract(
        address indexed deployer,
        address indexed deployedAddress,
        bool indexed isERC721
    );

    function initialize(address _gatewayAddress) public initializer {
        gatewayAddress = _gatewayAddress;
    }

    /**
     * Deploy a BasicERC721 contract.
     */
    function deployBasicERC721(
        string calldata _name,
        string calldata _symbol,
        string calldata _baseURI,
        uint256 _salt
    ) external returns (address deployedAddress) {
        // Deploy the contract and set its gateway.
        deployedAddress = address(
            new BasicERC721{salt: bytes32(_salt)}(
                _name,
                _symbol,
                _baseURI,
                gatewayAddress
            )
        );

        emit DeployContract(msg.sender, deployedAddress, true);

        // Set manager of the newly deployed contract.
        INFTGateway(gatewayAddress).setManagerOf(deployedAddress, msg.sender);
    }

    /**
     * Deploy a BasicERC1155 contract.
     */
    function deployBasicERC1155(string calldata _uri, uint256 _salt)
        external
        returns (address deployedAddress)
    {
        // Deploy the contract and set its gateway.
        deployedAddress = address(
            new BasicERC1155{salt: bytes32(_salt)}(_uri, gatewayAddress)
        );

        emit DeployContract(msg.sender, deployedAddress, false);

        // Set manager of the newly deployed contract.
        INFTGateway(gatewayAddress).setManagerOf(deployedAddress, msg.sender);
    }
}
