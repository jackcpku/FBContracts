// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract PVSStake {
    using SafeMath for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint256 public totalRewardPerSecond;

    uint256 public accumulatedRewardPerWeight;

    uint256 public totalWeight;

    uint256 lastUpdateTimestamp;

    struct SingleStake {
        uint256 amount;
        uint256 beginTimestamp;
        uint256 endTimestamp;
        bool unstaked;
    }

    struct StakerInfo {
        uint256 checkpointReward;
        uint256 checkpointRewardPerWeight;
        uint256 weight;
        SingleStake[] stakes;
    }
    address public pvsAddress;

    mapping(address => StakerInfo) public stakers;

    event Stake(
        address indexed staker,
        uint256 indexed amount,
        uint256 indexed duration
    );

    event Unstake(
        address indexed staker,
        uint256 indexed amount,
        uint256 indexed duration
    );

    constructor(address _pvsAddress, uint256 _totalRewardPerSecond) {
        pvsAddress = _pvsAddress;
        totalRewardPerSecond = _totalRewardPerSecond;
    }

    function stake(
        address _staker,
        uint256 _amount,
        uint256 _duration
    ) external {
        /******** CHECKS ********/

        /******** EFFECTS ********/

        _updateCheckpoint(_staker);

        uint256 addWeight = _stakeWeight(_duration, _amount);

        StakerInfo storage info = stakers[_staker];

        info.weight += addWeight;
        totalWeight += addWeight;

        info.stakes.push(
            SingleStake(
                _amount,
                block.timestamp,
                block.timestamp + _duration,
                false
            )
        );

        // Transfer tokens
        IERC20Upgradeable(pvsAddress).safeTransferFrom(
            _staker,
            address(this),
            _amount
        );

        /******** LOGS ********/

        emit Stake(_staker, _amount, _duration);
    }

    function unstake(
        address _staker,
        uint256 _index,
        bool _claimReward
    ) external {
        /******** CHECKS ********/
        require(_checkUnstake(_staker, _index), "PVSStake: failed to unstake");

        /******** EFFECTS ********/
        _updateCheckpoint(_staker);

        StakerInfo storage info = stakers[_staker];
        uint256 duration = info.stakes[_index].endTimestamp -
            info.stakes[_index].beginTimestamp;

        uint256 withdrawAmount = info.stakes[_index].amount;

        uint256 removeWeight = _stakeWeight(duration, withdrawAmount);

        stakers[_staker].weight -= removeWeight;
        totalWeight -= removeWeight;

        info.stakes[_index].unstaked = true;

        if (_claimReward) {
            withdrawAmount += info.checkpointReward;
            info.checkpointReward = 0;
        }

        // Transfer tokens
        IERC20Upgradeable(pvsAddress).safeTransferFrom(
            address(this),
            _staker,
            withdrawAmount
        );

        /******** LOGS ********/

        emit Unstake(_staker, withdrawAmount, duration);
    }

    function unstakeAll(address _staker) external {
        StakerInfo storage info = stakers[_staker];
        for (uint256 index = 0; index < info.stakes.length; index++) {
            bool validUnstake = _checkUnstake(_staker, index);
            if (!validUnstake) continue;

            this.unstake(_staker, index, true);
        }
    }

    function _checkUnstake(address _staker, uint256 _index)
        internal
        view
        returns (bool)
    {
        StakerInfo storage info = stakers[_staker];
        if (_index > info.stakes.length) {
            return false;
        }
        if (
            info.stakes[_index].unstaked ||
            info.stakes[_index].endTimestamp > block.timestamp
        ) {
            return false;
        }
        return true;
    }

    function _updateCheckpoint(address _staker) internal {
        // Get the reference to staker's info
        StakerInfo storage info = stakers[_staker];

        uint256 addedReward = (accumulatedRewardPerWeight -
            info.checkpointRewardPerWeight) * info.weight;

        info.checkpointReward += addedReward;
        info.checkpointRewardPerWeight = accumulatedRewardPerWeight;

        accumulatedRewardPerWeight +=
            ((block.timestamp - lastUpdateTimestamp) * totalRewardPerSecond) /
            totalWeight;

        lastUpdateTimestamp = block.timestamp;
    }

    function _stakeWeight(uint256 _duration, uint256 _amount)
        internal
        pure
        returns (uint256)
    {
        return (1e6 + (_duration * 1e6) / 365 days) * _amount;
    }
}
