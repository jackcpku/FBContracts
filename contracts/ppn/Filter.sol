//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Filter is Ownable {
    using SafeERC20 for IERC20;

    address public pvsAddress;

    address public outputAddress;

    uint256 public constant ALPHA_DENOMINATOR = 10_000;

    uint256 public alpha;

    uint256 public lastOut;

    uint256 public lastBalance;

    uint256 public lastTime;

    constructor(
        address _pvsAddress,
        address _outputAddress,
        uint256 _alpha
    ) {
        pvsAddress = _pvsAddress;
        outputAddress = _outputAddress;
        alpha = _alpha;
    }

    function output() external {
        // Check if the time interval limit is exceeded
        require(
            block.timestamp >= lastTime + 1 days,
            "Filter: at most once a day"
        );
        lastTime = block.timestamp;

        uint256 currentBalance = IERC20(pvsAddress).balanceOf(address(this));
        uint256 newIn = currentBalance - lastBalance;

        uint256 newOut = (alpha *
            newIn +
            (ALPHA_DENOMINATOR - alpha) *
            lastOut) / ALPHA_DENOMINATOR;

        if (newOut > currentBalance) {
            newOut = currentBalance;
        }

        lastOut = newOut;

        IERC20(pvsAddress).safeTransfer(outputAddress, newOut);

        lastBalance = currentBalance - newOut;
    }

    function setOutputAddress(address _outputAddress) external onlyOwner {
        outputAddress = _outputAddress;
    }

    function setAlpha(uint256 _alpha) external onlyOwner {
        alpha = _alpha;
    }
}
