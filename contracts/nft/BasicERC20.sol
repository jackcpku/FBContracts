// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./management/GatewayGuarded.sol";
import "./interfaces/IGateway.sol";
import "./interfaces/IBasicERC20.sol";

contract BasicERC20 is IBasicERC20, ERC20, GatewayGuarded {
    /**
     * @param gateway NFTGateway contract of the NFT contract.
     */
    constructor(
        string memory name,
        string memory symbol,
        address gateway
    ) ERC20(name, symbol) GatewayGuarded(gateway) {}

    function mint(address to, uint256 amount) external override onlyGateway {
        _mint(to, amount);
    }
}
