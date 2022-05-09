// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "./management/GatewayGuarded.sol";
import "./interfaces/IGateway.sol";
import "./interfaces/IBasicERC20.sol";
import "./Depositable.sol";

contract BasicERC20Capped is
    IBasicERC20,
    ERC20Capped,
    Depositable,
    GatewayGuarded
{
    /**
     * @param gateway Gateway contract of the ERC20 contract.
     */
    constructor(
        string memory name,
        string memory symbol,
        address depositAddress,
        uint256 cap,
        address gateway
    )
        ERC20(name, symbol)
        ERC20Capped(cap)
        Depositable(depositAddress)
        GatewayGuarded(gateway)
    {}

    function mint(address to, uint256 amount) external override onlyGateway {
        _mint(to, amount);
    }
}
