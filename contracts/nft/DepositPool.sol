// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface ITransferable {
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external;
}

contract DepositPool is Pausable, Ownable {
    mapping(address => mapping(uint256 => bool)) deposited;
    mapping(address => mapping(uint256 => bool)) withdrawn;

    address public withdrawer;

    event Deposit(
        address indexed tokenAddress,
        address indexed depositor,
        uint256 amount,
        uint256 indexed depositId
    );

    event Withdraw(
        address indexed tokenAddress,
        address indexed to,
        uint256 amount,
        uint256 indexed salt
    );

    modifier onlyWithdrawer() {
        require(
            msg.sender == withdrawer,
            "DepositPool: msg.sender is not withdrawer"
        );
        _;
    }

    constructor() {}

    function deposit(
        address _erc20TokenAddress,
        uint256 _amount,
        uint256 _depositId
    ) external {
        require(
            !deposited[_erc20TokenAddress][_depositId],
            "DepositPool: invalid deposit id"
        );
        ITransferable(_erc20TokenAddress).transferFrom(
            msg.sender,
            address(this),
            _amount
        );

        emit Deposit(_erc20TokenAddress, msg.sender, _amount, _depositId);
    }

    function withdraw(
        address _erc20TokenAddress,
        address _to,
        uint256 _amount,
        uint256 _salt
    ) external onlyWithdrawer {
        require(
            !withdrawn[_erc20TokenAddress][_salt],
            "DepositPool: invalid salt"
        );

        ITransferable(_erc20TokenAddress).transferFrom(
            address(this),
            _to,
            _amount
        );

        withdrawn[_erc20TokenAddress][_salt] = true;

        emit Withdraw(_erc20TokenAddress, _to, _amount, _salt);
    }

    function setWithdrawer(address _withdrawer) external onlyOwner {
        require(
            _withdrawer != withdrawer,
            "DepositPool: should assign a different withdrawer"
        );

        withdrawer = _withdrawer;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
