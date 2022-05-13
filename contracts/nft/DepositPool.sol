// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface ITransferable {
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external;
}

contract DepositPool is AccessControl, Pausable {
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");

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

    constructor(address _depositPoolAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, _depositPoolAdmin);
    }

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
    ) external onlyRole(WITHDRAWER_ROLE) {
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

    function setWithdrawer(address _withdrawer)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            _withdrawer != withdrawer,
            "DepositPool: should assign a different withdrawer"
        );

        _revokeRole(WITHDRAWER_ROLE, withdrawer);
        withdrawer = _withdrawer;
        _grantRole(WITHDRAWER_ROLE, withdrawer);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
