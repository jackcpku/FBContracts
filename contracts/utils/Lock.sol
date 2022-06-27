//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Lock is Ownable {
    using SafeERC20 for IERC20;

    address tokenAddress;
    uint256 expirationTime;

    address recipient;

    event Withdraw(uint256 amount);

    modifier afterExpiration() {
        require(
            block.timestamp > expirationTime,
            "Lock: cannot operate before expiration time"
        );
        _;
    }

    constructor(address _tokenAddress, address _recipient) {
        tokenAddress = _tokenAddress;
        recipient = _recipient;

        expirationTime = block.timestamp;
    }

    function extendLockingPeriod(uint256 _days) external {
        expirationTime += _days * 1 days;
    }

    function withdraw(uint256 _amount) external onlyOwner afterExpiration {
        IERC20(tokenAddress).safeTransferFrom(
            address(this),
            recipient,
            _amount
        );

        emit Withdraw(_amount);
    }
}
