//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./FunBoxToken.sol";

contract VestingContract {
    using SafeERC20 for FunBoxToken;

    address public TOKEN_ADDRESS;
    uint256 public TOTAL_AMOUNT;

    mapping(address => uint256) public beneficiary_proportion;
    mapping(address => uint256) public released;

    // Timing related constants (unix time).
    uint256 public _start /*= 1000000000*/;
    uint256[] public _stages /*= [0, 20000, 40000, 60000]*/;

    /**
     * Unlock proportion in corresponding stage.
     */
    uint256[] public _unlock_proportion /*= [0, 100, 300, 600]*/;

    constructor(
        address tokenAddress,
        uint256 totalAmount,
        address[] memory beneficiaries,
        uint256[] memory proportions,
        uint256 start,
        uint256[] memory stages,
        uint256[] memory unlock_proportion
    ) {
        TOKEN_ADDRESS = tokenAddress;
        TOTAL_AMOUNT = totalAmount;

        require(totalAmount > 0);
        require(beneficiaries.length == proportions.length);
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            beneficiary_proportion[beneficiaries[i]] = proportions[i];
        }

        _start = start;
        require(_stages.length == unlock_proportion.length);
        for (uint256 i = 0; i < _stages.length; i++) {
            _stages[i] = stages[i];
            _unlock_proportion[i] = unlock_proportion[i];
        }
    }

    function release() public {
        require(
            beneficiary_proportion[msg.sender] != 0,
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
        FunBoxToken(TOKEN_ADDRESS).safeTransfer(
            msg.sender,
            releasable
        );
    }

    /**
     * The scheduled vest amount of a certain beneficiary.
     */
    function _vestingAmountSchedule(address beneficiary, uint256 timestamp)
        internal
        view
        returns (uint256 amount)
    {
        return
            (TOTAL_AMOUNT *
                _vestingProportionSchedule(timestamp) *
                beneficiary_proportion[beneficiary]) / 1_000_000;
    }

    /**
     * Returns scheduled vest proportion of all beneficiaries.
     * Return between [0, 1000] since floating numbers are not supported.
     */
    function _vestingProportionSchedule(uint256 timestamp)
        internal
        view
        returns (uint256 nominator)
    {
        for (uint i = 0; i < _stages.length; i++) {
            if (timestamp < _start + _stages[i]) {
                return _unlock_proportion[i];
            }
        }
        return 1000;
    }
}
