// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "../interfaces/IGateway.sol";
import "../BasicERC20.sol";
import "../BasicERC20Capped.sol";

contract ERC20Factory is Initializable {
    address public gatewayAddress;

    event DeployContract(
        address indexed deployer,
        address indexed deployedAddress,
        bool indexed capped
    );

    function initialize(address _gatewayAddress) public initializer {
        gatewayAddress = _gatewayAddress;
    }

    /**
     * Deploy a BasicERC20 contract.
     * @param _cap The upperbound of the total token supply. If _cap is `0`,
     * it means there's no limitation.
     */
    function deployBasicERC20(
        string calldata _name,
        string calldata _symbol,
        address _depositAddress,
        uint256 _cap,
        uint256 _salt
    ) external returns (address deployedAddress) {
        if (_cap == 0) {
            // Deploy the contract and set its gateway.
            deployedAddress = address(
                new BasicERC20{salt: bytes32(_salt)}(
                    _name,
                    _symbol,
                    _depositAddress,
                    gatewayAddress
                )
            );
        } else {
            deployedAddress = address(
                new BasicERC20Capped{salt: bytes32(_salt)}(
                    _name,
                    _symbol,
                    _depositAddress,
                    _cap,
                    gatewayAddress
                )
            );
        }

        emit DeployContract(msg.sender, deployedAddress, _cap != 0);

        // Set manager of the newly deployed contract.
        IGateway(gatewayAddress).setManagerOf(deployedAddress, msg.sender);
    }
}
