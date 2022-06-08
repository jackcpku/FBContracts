// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * The platform will release NFT in multiple periods, and addresses holding NFT can get a certain percentage of platform NFT Market revenue dividends.
 * This Contract is designed for helping the platform to calculate and distribute dividends for each nft in each period.
 * During a period, the incoming dividend xter will be evenly distributed to all NFTs that have been released.
 */

contract Dividend {
    using SafeERC20 for IERC20;

    // The token used to pay dividends
    address public xterAddress;

    // XPN address
    address public ppnAddress;

    // current period
    uint256 public currentPeriod;

    // Total amount of XTER that has been claimed
    uint256 public totalClaimed;

    // Dividend that has been claimed by one XPN
    mapping(uint256 => uint256) public hasClaimed;

    // Dividend that has been claimed by one address
    mapping(address => uint256) public addressClaimed;

    // All xter(dividend) at the beginning of current period
    uint256 public accumulatedPool;

    // accumulatedDividends[i] means the accumulated dividends for one XPN during period k where 0 <= k < i.
    // For one XPN released in period j, it can only receive dividends of period k where k >= j,
    // so at the beginning of current period, the accumulated dividends of one XPN released in period j
    //      = accumulatedDividends[currentPeriod] - accumulatedDividends[j]
    // Note that accumulatedDividends[0] = 0
    uint256[] public accumulatedDividends;

    // each period begined second
    uint256[] public periodStartTime;

    // fixed amount of release in each period
    uint256 public constant NFT_AMOUNT_RELASED_PER_PERIOD = 6_000;

    event UpdatePeriod(
        address indexed operator,
        uint256 newPeriod,
        uint256 totalAmount
    );

    event Claim(
        address indexed receiver,
        uint256 indexed tokenId,
        uint256 amount
    );

    constructor(
        address _xterAddress,
        address _ppnAddress,
        uint256[] memory _periodStartTime
    ) {
        xterAddress = _xterAddress;
        ppnAddress = _ppnAddress;
        periodStartTime = _periodStartTime;
        accumulatedDividends.push(0);
    }

    /**
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
        // 1. At the beginning of _newPeriod, the dividend pool of the previous period is calculated and locked according to the real-time xter balance.
        uint256 lastPool = IERC20(xterAddress).balanceOf(address(this)) +
            totalClaimed -
            accumulatedPool;

        // 2. calculate: accumulatedDividends[_newPeriod] = accumulated dividends for one XPN during period k where 0 <= k < _newPeriod.
        accumulatedDividends.push(
            accumulatedDividends[currentPeriod] + lastPool / releasedPPNAmount()
        );

        // 3. accumulate xter pool
        accumulatedPool += lastPool;

        // 4. update period
        currentPeriod = _newPeriod;

        emit UpdatePeriod(msg.sender, currentPeriod, releasedPPNAmount());
    }

    /**
     * Get one nft's released period
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
     * Get the total dividends of one XPN from its released period
     * The accumulated dividends of one XPN
     *      = the accumulated dividends at the beginning of current period + the dividends accumulated during current period.
     *      = (accumulatedDividends[currentPeriod] - accumulatedDividends[releasedPeriod) + currentDividends
     */
    function totalDividend(uint256 _tokenId) public view returns (uint256) {
        // get the nft's released period
        uint256 releasedPeriod = getPeriod(_tokenId);
        uint256 currentDividends = (IERC20(xterAddress).balanceOf(
            address(this)
        ) +
            totalClaimed -
            accumulatedPool) / releasedPPNAmount();
        return
            accumulatedDividends[currentPeriod] -
            accumulatedDividends[releasedPeriod] +
            currentDividends;
    }

    // claim batch
    function claim(uint256[] calldata _tokenIds) external {
        uint256 totalAmount;
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 _tokenId = _tokenIds[i];
            require(
                IERC721(ppnAddress).ownerOf(_tokenId) == msg.sender,
                "Dividend: you are not the owner of the nft"
            );
            uint256 amount = totalDividend(_tokenId) - hasClaimed[_tokenId];
            hasClaimed[_tokenId] += amount;

            emit Claim(msg.sender, _tokenId, amount);
            totalAmount += amount;
        }
        totalClaimed += totalAmount;
        addressClaimed[msg.sender] += totalAmount;
        IERC20(xterAddress).safeTransfer(msg.sender, totalAmount);
    }

    // for one XPN remain dividends = total dividends - dividends has been claimed
    function remainingDividend(uint256 _tokenId) public view returns (uint256) {
        return totalDividend(_tokenId) - hasClaimed[_tokenId];
    }

    // total released XPN amount in currentPeriod (0-based)
    function releasedPPNAmount() internal view returns (uint256) {
        return NFT_AMOUNT_RELASED_PER_PERIOD * (currentPeriod + 1);
    }

    function remainingDividends(uint256[] calldata _tokenIds)
        external
        view
        returns (uint256)
    {
        uint256 totalAmount;
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            totalAmount += remainingDividend(_tokenIds[i]);
        }
        return totalAmount;
    }

    function totalDividends(uint256[] calldata _tokenIds)
        external
        view
        returns (uint256)
    {
        uint256 totalAmount;
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            totalAmount += totalDividend(_tokenIds[i]);
        }
        return totalAmount;
    }
}
