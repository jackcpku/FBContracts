// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

abstract contract Depositable {
    using SafeERC20 for IERC20;
    address depositAddress;

    event Deposit(
        address indexed depositor,
        address depositAddress,
        uint256 indexed amount,
        uint256 indexed uid
    );

    constructor(address _depositAddress) {
        depositAddress = _depositAddress;
    }

    function deposit(uint256 amount, uint256 uid) external {
        IERC20(address(this)).safeTransferFrom(
            msg.sender,
            depositAddress,
            amount
        );

        emit Deposit(msg.sender, depositAddress, amount, uid);
    }
}
