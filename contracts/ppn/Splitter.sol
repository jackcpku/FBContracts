//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Splitter is Ownable {
    using SafeERC20 for IERC20;

    address public pvsAddress;

    enum ToAddressType {
        BURN,
        PLATFORM,
        DIVIDEND
    }

    // [burnAddress, platformAddress, dividendAddress]
    // burnAddress = 0x000000000000000000000000000000000000dEaD;
    address[] public splitAddress;

    uint256[] public splitProportion;

    uint256 public constant PROPORTION_DENOMINATOR = 10_000;

    event Split(
        ToAddressType toAddressType,
        address indexed from,
        address indexed to,
        uint256 value
    );

    event Reset(
        address indexed operator,
        address[] indexed Address,
        uint256[] proportion
    );

    constructor(
        address _pvsAddress,
        address[] memory _splitAddress,
        uint256[] memory _splitProportion
    ) {
        pvsAddress = _pvsAddress;

        require(
            _splitAddress.length == _splitProportion.length,
            "Splitter: address length must equal to proportion length"
        );

        require(
            _splitAddress.length == 3,
            "Splitter: only three addresses allowed"
        );
        splitAddress = _splitAddress;
        // splitProportion = [5_000, 4_650, 350];
        splitProportion = _splitProportion;
    }

    function output() external {
        uint256 amount = IERC20(pvsAddress).balanceOf(address(this));
        require(amount > 100, "Splitter: amount to split must > 100");

        for (uint256 i = 0; i < splitAddress.length; i++) {
            IERC20(pvsAddress).safeTransfer(
                splitAddress[i],
                (amount * splitProportion[i]) / PROPORTION_DENOMINATOR
            );
            emit Split(
                i == 0
                    ? ToAddressType.BURN
                    : (
                        i == 1 ? ToAddressType.PLATFORM : ToAddressType.DIVIDEND
                    ),
                address(this),
                splitAddress[i],
                (amount * splitProportion[i]) / PROPORTION_DENOMINATOR
            );
        }
    }

    // owner reset addresses / proportions
    function reset(
        address[] calldata _splitAddress,
        uint256[] calldata _splitProportion
    ) external onlyOwner {
        require(
            _splitAddress.length == _splitProportion.length,
            "Splitter: reset failed"
        );
        splitAddress = _splitAddress;
        splitProportion = _splitProportion;
        emit Reset(msg.sender, splitAddress, splitProportion);
    }
}
