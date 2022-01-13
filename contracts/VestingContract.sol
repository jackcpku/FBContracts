//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract VestingContract {
    using SafeERC20 for IERC20;

    address public tokenAddress;
    uint256 public totalAmount;

    mapping(address => uint256) public beneficiaryProportion;
    mapping(address => uint256) public released;

    // Timing related constants (unix time).
    uint256 public startSecond /*= 1000000000*/;
    uint256[] public stageSecond /*= [0, 20000, 40000, 60000]*/;

    /**
     * Unlock proportion in corresponding stage.
     */
    uint256[] public unlockProportion /*= [0, 100, 300, 600]*/;

    constructor(
        address _tokenAddress,
        uint256 _totalAmount,
        address[] memory _beneficiaries,
        uint256[] memory _proportions,
        uint256 _start,
        uint256[] memory _stages,
        uint256[] memory _unlockProportion
    ) {
        tokenAddress = _tokenAddress;
        totalAmount = _totalAmount;

        require(totalAmount > 0);
        require(_beneficiaries.length == _proportions.length);
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            beneficiaryProportion[_beneficiaries[i]] = _proportions[i];
        }

        startSecond = _start;
        require(_stages.length == _unlockProportion.length);
        for (uint256 i = 0; i < _stages.length; i++) {
            stageSecond.push(_stages[i]);
            unlockProportion.push(_unlockProportion[i]);
        }
    }

    function release() public {
        require(
            beneficiaryProportion[msg.sender] != 0,
            "Only beneficiaries receive."
        );

        uint256 scheduledRelease = _vestingAmountSchedule(
            msg.sender,
            block.timestamp
        );

        require(
            scheduledRelease > released[msg.sender],
            "Tokens not available."
        );

        uint256 releasable = scheduledRelease - released[msg.sender];

        released[msg.sender] += releasable;
        
        // send ERC20 token to `msg.sender`.
        IERC20(tokenAddress).safeTransfer(
            msg.sender,
            releasable
        );
    }

    function tokenBalance() public view returns (uint256) {
        return IERC20(tokenAddress).balanceOf(address(this));
    }

    /**
     * The scheduled vest amount of a certain beneficiary.
     */
    function _vestingAmountSchedule(address beneficiary, uint256 timestamp)
        public
        view
        returns (uint256 amount)
    {
        return
            (totalAmount *
                _vestingProportionSchedule(timestamp) *
                beneficiaryProportion[beneficiary]) / 1_000_000;
    }

    /**
     * Returns scheduled vest proportion of all beneficiaries.
     * Return between [0, 1000] since floating numbers are not supported.
     */
    function _vestingProportionSchedule(uint256 timestamp)
        public
        view
        returns (uint256 nominator)
    {
        for (uint i = 0; i < stageSecond.length; i++) {
            if (timestamp < startSecond + stageSecond[i]) {
                return unlockProportion[i];
            }
        }
        return 1000;
    }
}
