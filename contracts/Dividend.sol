// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Dividend is Ownable { 
    using SafeERC20 for IERC20;

    //pvsAddress
    address public pvsAddress;
    
    //Number of nft minted per period
    uint256 public constant PERIOD_MINTED_AMOUNT = 2000;
    
    //Dividend period
    uint256 public period;
    
    //Total amount of PVS that has been claimed
    uint256 public totalReleased;
    
    //Sum of dividend in all of previous periods
    uint256 public totalPool;

    //Sum of dividend in a specific period
    mapping(uint256 => uint256) pool;	

    //Each nft‘s dividend in a specific period
    mapping(uint256 => uint256) periodProfit;

    //Dividend of a nft that has been claimed
    mapping(uint256 => uint256) hasClaimed;	


    function updatePeriod(uint256 _newPeriod) external onlyOwner {
        //update last period pool, periodProfit, totalPool
        if (_newPeriod == 1) {
            period = _newPeriod;
            return;
        } else {
            require(_newPeriod > period, "The new period must be later than the present");
            pool[period] = IERC20(pvsAddress).balanceOf(address(this)) + totalReleased - totalPool;
            periodProfit[period] = pool[period] / (PERIOD_MINTED_AMOUNT * period);
            totalPool += pool[period];
            period = _newPeriod;
        }
    } 

    function totalDividend(uint256 _tokenId) public view returns (uint256) {
        uint256 beginPeriod = getPeriod(_tokenId);

        uint256 previousProfit;
        for (uint256 i = beginPeriod; i < period; i++) {
            previousProfit += periodProfit[i];
        }

        uint256 profit = (IERC20(pvsAddress).balanceOf(address(this)) + totalReleased - totalPool) / (PERIOD_MINTED_AMOUNT * period);

        return previousProfit + profit;
    } 

    function claim(uint256 _tokenId) public {
        //todo check 

        uint256 amount = totalDividend(_tokenId) - hasClaimed[_tokenId];
        IERC20(pvsAddress).safeTransfer(msg.sender, amount);
        hasClaimed[_tokenId] += amount;
    }

    function claimBatch(uint256[] calldata _tokenIds) external {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            claim(_tokenIds[i]);
        }
    }

    function getPeriod(uint256 _tokenId) internal pure returns (uint256) {
        return _tokenId / PERIOD_MINTED_AMOUNT + 1;
    }
}