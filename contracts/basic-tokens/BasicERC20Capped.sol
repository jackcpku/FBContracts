// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "./management/GatewayGuarded.sol";
import "./interfaces/IGateway.sol";
import "./interfaces/IBasicERC20.sol";

contract BasicERC20Capped is
    IBasicERC20,
    ERC20Burnable,
    ERC20Capped,
    GatewayGuarded,
    Pausable
{
    /**
     * @param gateway Gateway contract of the ERC20 contract.
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 cap,
        address gateway
    ) ERC20(name, symbol) ERC20Capped(cap) GatewayGuarded(gateway) {}

    function mint(address to, uint256 amount) external override onlyGateway {
        _mint(to, amount);
    }

    function _mint(address to, uint256 amount)
        internal
        override(ERC20, ERC20Capped)
    {
        ERC20Capped._mint(to, amount);
    }

    function pause() external onlyGateway {
        _pause();
    }

    function unpause() external onlyGateway {
        _unpause();
    }
}
