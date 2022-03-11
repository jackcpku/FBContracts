// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * The platform will release NFT in multiple periods, and addresses holding NFT can get a certain percentage of platform NFT Market revenue dividends.
 * This Contract is designed for helping the platform to calculate and distribute dividends for each nft in each period.
 * During a period, the pvs held by this contract will be evenly distributed to all NFTs that have been released at the .
 *
 * 1. At the beginning of each period, the dividend pool of the previous period is calculated and locked according to the real-time pvs balance.
 * 2. The accumulated dividend amount of a certain nft to the current period  = the accumulated dividend amount from the period when it was minted + the dividend amount of current period.
 */

contract Dividend {
    using SafeERC20 for IERC20;

    // The token used to pay dividends
    address public pvsAddress;

    // PPN address
    address public ppnAddress;

    // current period
    uint256 public currentPeriod;

    // Total amount of PVS that has been claimed
    uint256 public totalClaimed;

    // Dividend that has been claimed by one PPN
    mapping(uint256 => uint256) public hasClaimed;

    // All pvs(dividend) at the begining of current period
    uint256 public accumulatedPool;

    // accumulatedDividends[i] means the accumulated dividends for one PPN during period k where 0 <= k < i.
    // For one PPN released in period j, it can only receive dividends of period k where k >= j,
    // so at the begining of current period, the accumulated dividends of one PPN released in period j
    //      = accumulatedDividends[currentPeriod] - accumulatedDividends[j]
    // Note that accumulatedDividends[0] = 0
    uint256[] public accumulatedDividends;

    // each period begined second
    uint256[] public periodStartTime;

    // fixed amount of release in each period
    uint256 public constant NFT_AMOUNT_RELASED_PER_PERIOD = 2_000;

    event UpdatePeriod(
        address indexed operator,
        uint256 newPeriod,
        uint256 totalAmount
    );

    event Claim(address indexed receiver, uint256 tokenId, uint256 amount);

    constructor(
        address _pvsAddress,
        address _ppnAddress,
        uint256[] memory _periodStartTime
    ) {
        pvsAddress = _pvsAddress;
        ppnAddress = _ppnAddress;
        periodStartTime = _periodStartTime;
        accumulatedDividends.push(0); 
    }

    /**
     * Deduce and lock previous period's accumulated dividends of each nft
     * Update totalAmount of nft & maxTokenId in the new period
     * Update period
     */
    function updatePeriod(uint256 _newPeriod) external {
        require(
            _newPeriod == currentPeriod + 1,
            "Dividend: the new period must be exactly one period after the present"
        );
        require(
            block.timestamp >= periodStartTime[_newPeriod],
            "Dividend: the next period has not yet begun"
        );

        uint256 lastPool = IERC20(pvsAddress).balanceOf(address(this)) + totalClaimed - accumulatedPool;

        accumulatedDividends.push(0);
        accumulatedDividends[_newPeriod] = accumulatedDividends[currentPeriod] + lastPool / releasedPPNAmount();

        accumulatedPool += lastPool;
        currentPeriod = _newPeriod;

        emit UpdatePeriod(msg.sender, currentPeriod, releasedPPNAmount());
    }

    /**
     * Get one nft's minted period
     */
    function getPeriod(uint256 _tokenId) internal view returns (uint256) {
        require(
            _tokenId > 0 && _tokenId <= releasedPPNAmount(),
            "Dividend: tokenId exceeded limit"
        );
        // ceilDiv
        return ((_tokenId - 1) / NFT_AMOUNT_RELASED_PER_PERIOD);
    }

    /**
     * Get the total dividend of a nft from its minted period
     * The accumulated dividend amount of a certain nft to the current period
     * 	= the accumulated dividend amount from the period when it was minted + the dividend amount of current period.
     */
    function totalDividend(uint256 _tokenId) public view returns (uint256) {
        // get the nft's minted period
        uint256 releasedPeriod = getPeriod(_tokenId);
        uint256 current = (IERC20(pvsAddress).balanceOf(address(this)) + totalClaimed - accumulatedPool) / releasedPPNAmount();
        return accumulatedDividends[currentPeriod] - accumulatedDividends[releasedPeriod] + current;
    }

    // claim dividend for nft with _tokenId
    function claim(uint256 _tokenId) public {
        require(
            IERC721(ppnAddress).ownerOf(_tokenId) == msg.sender,
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

    // total minted amount in currentPeriod (0-based)
    function releasedPPNAmount() internal view returns (uint256) {
        return NFT_AMOUNT_RELASED_PER_PERIOD * (currentPeriod + 1);
    }
}
