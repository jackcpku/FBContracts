// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "../interfaces/INFTGateway.sol";
import "../BasicERC721.sol";
import "../BasicERC1155.sol";

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

        // Grant this contract temporary permission to call `ERC721_setURI`
        INFTGateway(gatewayAddress).setManagerOf(
            deployedAddress,
            address(this)
        );

        // Set uri of the newly deployed contract.
        INFTGateway(gatewayAddress).ERC721_setURI(
            deployedAddress,
            string(
                abi.encodePacked(_baseURI, addrToString(deployedAddress), "/")
            )
        );

        // Set manager of the newly deployed contract.
        INFTGateway(gatewayAddress).setManagerOf(deployedAddress, msg.sender);
    }

    /**
     * Deploy a BasicERC1155 contract.
     */
    function deployBasicERC1155(string calldata _baseURI, uint256 _salt)
        external
        returns (address deployedAddress)
    {
        // Deploy the contract and set its gateway.
        deployedAddress = address(
            new BasicERC1155{salt: bytes32(_salt)}(_baseURI, gatewayAddress)
        );

        emit DeployContract(msg.sender, deployedAddress, false);

        // Grant this contract temporary permission to call `ERC1155_setURI`
        INFTGateway(gatewayAddress).setManagerOf(
            deployedAddress,
            address(this)
        );

        // Set uri of the newly deployed contract.
        INFTGateway(gatewayAddress).ERC1155_setURI(
            deployedAddress,
            string(
                abi.encodePacked(
                    _baseURI,
                    addrToString(deployedAddress),
                    "/{id}"
                )
            )
        );

        // Set manager of the newly deployed contract.
        INFTGateway(gatewayAddress).setManagerOf(deployedAddress, msg.sender);
    }

    function addrToString(address addr) internal pure returns (string memory) {
        bytes memory data = abi.encodePacked(addr);

        bytes memory alphabet = "0123456789abcdef";

        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < data.length; i++) {
            str[2 + i * 2] = alphabet[uint256(uint8(data[i] >> 4))];
            str[3 + i * 2] = alphabet[uint256(uint8(data[i] & 0x0f))];
        }
        return string(str);
    }
}
