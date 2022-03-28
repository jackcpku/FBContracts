//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Filter is Ownable {
    using SafeERC20 for IERC20;

    address public manager;

    address public pvsAddress;

    address public dividendAddress;

    uint256 public constant PROPORTION_DENOMINATOR = 10_000;

    uint256 public constant PROPORTION = 300;

    uint256 public lastOut;

    uint256 public currentPeriod;

    uint256 public periodProfit;

    event CumulativeProfit(uint256 period, uint256 profit);

    constructor(address _manager, address _pvsAddress) {
        manager = _manager;
        pvsAddress = _pvsAddress;
        lastOut = 0;
    }

    function updatePeriod(uint256 _newPeriod) external onlyOwner {
        require(
            _newPeriod == currentPeriod + 1,
            "Filter: the new period must be exactly one period after the present"
        );
        currentPeriod = _newPeriod;
        periodProfit = 0;
    }

    function filter(uint256 newIn) external onlyOwner {
        uint256 out = (PROPORTION / PROPORTION_DENOMINATOR) *
            newIn +
            (1 - PROPORTION / PROPORTION_DENOMINATOR) *
            lastOut;

        lastOut = out;

        IERC20(pvsAddress).safeTransfer(dividendAddress, out);
        
        periodProfit += out;
        emit CumulativeProfit(currentPeriod, periodProfit);
    }

    //
    function claim(address addr) external onlyOwner {
        IERC20(pvsAddress).safeTransfer(
            addr,
            IERC20(pvsAddress).balanceOf(address(this))
        );
    }
}
