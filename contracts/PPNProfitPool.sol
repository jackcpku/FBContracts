// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * This Contract is designed for 
 * 1. 
 * 2. 
 * 3. 
 * 4. 
 */

contract PPNProfitPool is Ownable { 
    using SafeERC20 for IERC20;

    // The token used to pay dividends
    address public pvsAddress;
    
    // period of divide
    uint256 public period;
    
    // Total amount of PVS that has been claimed
    uint256 public totalClaimed;
    
    // Sum of dividend in all of previous periods
    uint256 public totalPool;

    // total # of nft minted in all of previous periods
    uint256 public totalAmount;

    // max tokenId in each period
    uint256[] public maxTokenId;

    // Dividends per nft per period
    uint256[] public periodProfit;

    // Dividend that has been claimed by this nft's owner
    mapping(uint256 => uint256) public hasClaimed;

    // update last period pool, periodProfit, totalPool
    function updatePeriod(uint256 _newPeriod, uint256 _newAmt) external onlyOwner {
        if (_newPeriod == 1) {
            period = _newPeriod;
            maxTokenId[_newPeriod] = _newAmt;
            return;
        } else {
            require(_newPeriod > period, "The new period must be later than the present");

            uint256 pool = IERC20(pvsAddress).balanceOf(address(this)) + totalClaimed - totalPool;
            periodProfit[period] = pool / totalAmount;

            totalPool += pool;
            totalAmount += _newAmt;

            period = _newPeriod;
            maxTokenId[_newPeriod] = totalAmount;
        }
    } 

    function totalDividend(uint256 _tokenId) public view returns (uint256) {
        uint256 beginPeriod = getPeriod(_tokenId);

        uint256 previousProfit;
        for (uint256 i = beginPeriod; i < period; i++) {
            previousProfit += periodProfit[i];
        }

        uint256 profit = (IERC20(pvsAddress).balanceOf(address(this)) + totalClaimed - totalPool) / totalAmount;

        return previousProfit + profit;
    } 

    function claim(uint256 _tokenId) public {
        //todo check 

        uint256 amount = totalDividend(_tokenId) - hasClaimed[_tokenId];
        IERC20(pvsAddress).safeTransfer(msg.sender, amount);
        hasClaimed[_tokenId] += amount;
        totalClaimed += amount;
    }

    function claimBatch(uint256[] calldata _tokenIds) external {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            claim(_tokenIds[i]);
        }
    }

    function getPeriod(uint256 _tokenId) internal view returns (uint256) {
        require(_tokenId <= totalAmount, "tokenId exceeded limit");

        for (uint256 i = 1; i <= period; i++) {
            if (_tokenId <= maxTokenId[i]) {
                return i;
            }
        }
        return period;
    }
}