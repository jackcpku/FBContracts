// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * The platform will mint NFT in multiple periods, and addresses holding NFT can get a certain percentage of platform NFT Market revenue dividends.
 * This Contract is designed for helping the platform to calculate and distribute dividends for each nft in each period.
 * During a period time, the pvs held by this contract will be evenly distributed to all NFTs that have been minted at the .
 *
 * 1. At the beginning of each new period, the dividend pool of the previous period is calculated and locked according to the real-time pvs balance.
 * 2. The accumulated dividend amount of a certain nft to the current period  = the accumulated dividend amount from the period when it was minted + the dividend amount of current period.
 */

contract AutoDividend {
    using SafeERC20 for IERC20;

    // The token used to pay dividends
    address public pvsAddress;

    // PPN address
    address public tokenAddress;

    // period of divide
    uint256 public period;

    // Total amount of PVS that has been claimed
    uint256 public totalClaimed;

    // All pvs(dividend) that have been priced in
    uint256 public totalPool;

    // Dividends per nft per period
    uint256[] public dividends;

    // Dividend that has been claimed by this nft's owner
    mapping(uint256 => uint256) public hasClaimed;

    // startSecond of dividend
    uint256 public startSecond;

    // each period begins second from the startSecond
    uint256[] public periodSecond;

    // fixed amount of release in each period
    uint256 public constant NFT_AMOUNT_RELASED_PER_PERIOD = 2_000;

    event UpdatePeriod(
        address indexed operator,
        uint256 newPeriod,
        uint256 totalAmount
    );

    event Claim(address indexed receiver, uint256 tokenId, uint256 amount);

    // constructor, init period = 1 
    constructor(
        address _pvsAddress,
        address _tokenAddress,
        uint256 _startSecond,
        uint256[] memory _periods
    ) {
        pvsAddress = _pvsAddress;
        tokenAddress = _tokenAddress;
        startSecond = _startSecond;
        periodSecond = _periods;

        dividends.push(0);
        period = 1;
    }

    /**
     * Deduce and lock previous period's dividend of each nft
     * Update totalAmount of nft & maxTokenId in the new period
     * Update period
     */
    function updatePeriod(uint256 _newPeriod) external {
        require(
            _newPeriod == period + 1,
            "Dividend: the new period must be exactly one period after the present"
        );
        require(
            block.timestamp >= startSecond + periodSecond[_newPeriod],
            "Dividend: the next period has not yet begun"
        );

        uint256 pool = IERC20(pvsAddress).balanceOf(address(this)) + totalClaimed - totalPool;
        dividends.push(pool / (NFT_AMOUNT_RELASED_PER_PERIOD * period));
        totalPool += pool;

        period = _newPeriod;

        emit UpdatePeriod(
            msg.sender,
            period,
            (NFT_AMOUNT_RELASED_PER_PERIOD * period)
        );
    }

    /**
     * Get one nft's minted period
     */
    function getPeriod(uint256 _tokenId) internal view returns (uint256) {
        require(_tokenId > 0 && _tokenId <= (NFT_AMOUNT_RELASED_PER_PERIOD * period), "Dividend: tokenId exceeded limit");
        return ceilDiv(_tokenId, NFT_AMOUNT_RELASED_PER_PERIOD);
    }

    /**
     * Get the total dividend of a nft from its minted period
     * The accumulated dividend amount of a certain nft to the current period
     * 	= the accumulated dividend amount from the period when it was minted + the dividend amount of current period.
     */
    function totalDividend(uint256 _tokenId) public view returns (uint256) {
        // get the nft's minted period
        uint256 beginPeriod = getPeriod(_tokenId);
        // previous dividends
        uint256 previous;
        for (uint256 i = beginPeriod; i < period; i++) {
            previous += dividends[i];
        }
        // current dividend
        uint256 current = (IERC20(pvsAddress).balanceOf(address(this)) + totalClaimed - totalPool) / (NFT_AMOUNT_RELASED_PER_PERIOD * period);
        return previous + current;
    }

    // claim dividend for nft with _tokenId
    function claim(uint256 _tokenId) public {
        require(
            IERC721(tokenAddress).ownerOf(_tokenId) == msg.sender,
            "Dividend: Can't claim dividend because you are not the owner of the nft"
        );

        uint256 amount = totalDividend(_tokenId) - hasClaimed[_tokenId];
        IERC20(pvsAddress).safeTransfer(msg.sender, amount);
        hasClaimed[_tokenId] += amount;
        totalClaimed += amount;

        emit Claim(msg.sender, _tokenId, amount);
    }

    // claim batch
    function claimBatch(uint256[] calldata _tokenIds) external {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            claim(_tokenIds[i]);
        }
    }

    // remain dividends = the total dividends attributable to this nft - the dividends already been claimed
    function remainDividend(uint256 _tokenId) public view returns (uint256) {
        return totalDividend(_tokenId) - hasClaimed[_tokenId];
    }

    // ceilDiv 
    function ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return a / b + (a % b == 0 ? 0 : 1);
    }
}
