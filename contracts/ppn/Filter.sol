//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Filter is Ownable {
    using SafeERC20 for IERC20;

    address public pvsAddress;

    address public dividendAddress;

    uint256 public constant ALPHA_DENOMINATOR = 10_000;

    uint256 public constant ALPHA = 300;

    uint256 public lastOut;

    uint256 public totalIn;

    uint256 public lastTime;

    constructor(address _pvsAddress, address _dividendAddress) {
        pvsAddress = _pvsAddress;
        dividendAddress = _dividendAddress;
    }

    function output() external {
        // Check if the time interval limit is exceeded
        require(
            block.timestamp >= lastTime + 1 days,
            "Filter: at most once a day"
        );
        lastTime = block.timestamp;

        uint256 newIn = IERC20(pvsAddress).balanceOf(address(this)) - totalIn;

        uint256 newOut = (ALPHA / ALPHA_DENOMINATOR) *
            newIn +
            (1 - ALPHA / ALPHA_DENOMINATOR) *
            lastOut;

        lastOut = newOut;
        totalIn += newIn;

        IERC20(pvsAddress).safeTransfer(dividendAddress, newOut);
    }

    // owner reset addresses
    function reset(address _dividendAddress) external onlyOwner {
        dividendAddress = _dividendAddress;
    }
}
