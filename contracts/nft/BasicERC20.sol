// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./management/GatewayGuarded.sol";
import "./interfaces/IGateway.sol";
import "./interfaces/IBasicERC20.sol";
import "./Depositable.sol";

contract BasicERC20 is IBasicERC20, ERC20, Depositable, GatewayGuarded {
    /**
     * @param gateway Gateway contract of the ERC20 contract.
     */
    constructor(
        string memory name,
        string memory symbol,
        address depositAddress,
        address gateway
    ) ERC20(name, symbol) Depositable(depositAddress) GatewayGuarded(gateway) {}

    function mint(address to, uint256 amount) external override onlyGateway {
        _mint(to, amount);
    }
}
