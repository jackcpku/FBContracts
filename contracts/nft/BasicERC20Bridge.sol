// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

interface ITransferable {
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external;
}

contract BasicERC20Bridge is Ownable {
    mapping(uint256 => bool) withdrawn;

    event Deposit(
        address indexed depositor,
        uint256 indexed amount,
        uint256 indexed uid
    );

    event Withdraw(
        address indexed to,
        uint256 indexed amount,
        uint256 indexed salt
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

        emit Deposit(msg.sender, _amount, _uid);
    }

    function withdraw(
        address _erc20TokenAddress,
        address _to,
        uint256 _amount,
        uint256 _salt
    ) external onlyOwner {
        require(!withdrawn[_salt], "BasicERC20Bridge: invalid salt");

        ITransferable(_erc20TokenAddress).transferFrom(
            address(this),
            _to,
            _amount
        );

        withdrawn[_salt] = true;

        emit Withdraw(_to, _amount, _salt);
    }
}
