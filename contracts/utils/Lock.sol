//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Lock is Ownable {
    using SafeERC20 for IERC20;

    uint256 expirationTime;

    event Withdraw(address recipient, address tokenAddress, uint256 amount);

    event ExtendLockingPeriod(address operator, uint256 numOfDays);

    modifier afterExpiration() {
        require(
            block.timestamp > expirationTime,
            "Lock: cannot operate before expiration time"
        );
        _;
    }

    constructor(uint256 _days) {
        expirationTime = block.timestamp + _days * 1 days;
    }

    function extendLockingPeriod(uint256 _days) external {
        // Are there overflow concerns?
        expirationTime += _days * 1 days;

        emit ExtendLockingPeriod(msg.sender, _days);
    }

    function withdraw(
        address _recipient,
        address _tokenAddress,
        uint256 _amount
    ) external onlyOwner afterExpiration {
        IERC20(_tokenAddress).safeTransferFrom(
            address(this),
            _recipient,
            _amount
        );

        emit Withdraw(_recipient, _tokenAddress, _amount);
    }
}
