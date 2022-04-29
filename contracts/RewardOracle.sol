// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./nft-election/IPVSTicket.sol";

contract RewardOracle {
    address public pvstAddress;
    address public pvsAddress;
    address public pvsethLPAddress;

    uint256 public totalRewardPerSecondWhenStakingPVS;

    constructor(
        address _pvstAddress,
        address _pvsAddress,
        address _pvsethLPAddress
    ) {
        pvstAddress = _pvstAddress;
        pvsAddress = _pvsAddress;
        pvsethLPAddress = _pvsethLPAddress;
    }

    function immediatePVSTReward(
        address _stakedTokenAddress,
        uint256 _amount,
        uint256 _duration
    ) external view returns (uint256) {
        if (_stakedTokenAddress == pvsAddress) {
            return
                IPVSTicket(pvstAddress).PRODUCT_FACTOR() * _amount * _duration;
        } else if (_stakedTokenAddress == pvsethLPAddress) {
            revert("RewardOracle: not implemented");
        }

        revert("RewardOracle: bad staked token address");
    }

    function totalRewardPerSecond(address _stakedTokenAddress)
        external
        view
        returns (uint256)
    {
        if (_stakedTokenAddress == pvsAddress) {
            return totalRewardPerSecondWhenStakingPVS;
        } else if (_stakedTokenAddress == pvsethLPAddress) {
            revert("RewardOracle: not implemented");
        }

        revert("RewardOracle: bad staked token address");
    }
}
