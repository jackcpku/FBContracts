//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Splitter is Ownable {
    using SafeERC20 for IERC20;

    address public manager;

    address public pvsAddress;

    address public filterAddress;

    address public platformAddress;

    uint256 public constant PROPORTION_DENOMINATOR = 10_000;

    uint256[] public splitProportion;

    event Burn(address indexed from, address indexed to, uint256 value);
    event TransferToPlatform(
        address indexed from,
        address indexed to,
        uint256 value
    );
    event TransferToFilter(
        address indexed from,
        address indexed to,
        uint256 value
    );

    constructor(
        address _manager,
        address _pvsAddress,
        address _filterAddress,
        address _platformAddress
    ) {
        manager = _manager;
        pvsAddress = _pvsAddress;
        filterAddress = _filterAddress;
        platformAddress = _platformAddress;
        splitProportion = [5_000, 4_650, 350];
    }

    function split() external onlyOwner {
        uint256 amount = IERC20(pvsAddress).balanceOf(address(this));

        IERC20(pvsAddress).safeTransfer(
            address(0),
            (amount * splitProportion[0]) / PROPORTION_DENOMINATOR
        );
        emit Burn(
            address(this),
            address(0),
            (amount * splitProportion[0]) / PROPORTION_DENOMINATOR
        );

        IERC20(pvsAddress).safeTransfer(
            platformAddress,
            (amount * splitProportion[1]) / PROPORTION_DENOMINATOR
        );
        emit TransferToPlatform(
            address(this),
            platformAddress,
            (amount * splitProportion[1]) / PROPORTION_DENOMINATOR
        );

        IERC20(pvsAddress).safeTransfer(
            filterAddress,
            (amount * splitProportion[2]) / PROPORTION_DENOMINATOR
        );
        emit TransferToFilter(
            address(this),
            filterAddress,
            (amount * splitProportion[2]) / PROPORTION_DENOMINATOR
        );
    }
}
