// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IRewardOracle {
    function immediatePVSTReward(
        address _stakedTokenAddress,
        uint256 _amount,
        uint256 _duration
    ) external view returns (uint256);

    function totalRewardPerSecond(address _stakedTokenAddress)
        external
        pure
        returns (uint256);
}
