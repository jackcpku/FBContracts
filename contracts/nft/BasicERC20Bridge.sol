// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITransferable {
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external;
}

contract BasicERC20Bridge {
    event Deposit(
        address indexed depositor,
        address depositAddress,
        uint256 indexed amount,
        uint256 indexed uid
    );

    function deposit(
        address _erc20TokenAddress,
        uint256 _amount,
        uint256 _uid
    ) external {
        ITransferable(_erc20TokenAddress).transferFrom(
            msg.sender,
            address(this),
            _amount
        );

        emit Deposit(msg.sender, address(this), _amount, _uid);
    }
}
