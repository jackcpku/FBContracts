//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * This Contract is designed for staking our platform token:PVS to generate & manage our voting ticket:TKT
 * 1. Generate TKT accroding to the amount of PVS
 * 2. TKT implemented SimpleIERC20 standards, but transfers were restricted, and only whitelisted addresses can mint or burn
 */

interface SimpleIERC20 {

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function burn(address _ticketOwner, uint256 _amount) external;

    function mint(address _ticketOwner, uint256 _amount) external;

    event Transfer(address indexed from, address indexed to, uint256 value);
}

contract StakingPVSContract is OwnableUpgradeable, SimpleIERC20 {
    using SafeERC20 for IERC20;

    string private _name;
    string private _symbol;

    // the target ERC20 token for staking
    address public pvsAddress;

    uint256 public totalSupplyAtCheckpoint;

    mapping(address => bool) whitelist;

    //factor
    uint256 public constant PRODUCT_FACTOR = 10_000; 

    // last checkpoint time
    mapping (address => uint256) public checkpointTime;	

    // # of pvs at last checkpoint || now checkpoint
    // (if any change between this time interval , the pvs Balance will be updated automatically)
    mapping (address => uint256) public pvsBalance; 

    // # of tkt at last checkpoint
    mapping (address => uint256) public tktBalanceAtCheckpoint; 

    event TicketBurned(address indexed from, address indexed to, uint256 value);

    event TicketMinted(address indexed from, address indexed to, uint256 value);

    modifier onlyWhiteList() {
        require(whitelist[msg.sender], "No permission to burn or mint");
        _;
    }

     /********************************************************************
     *                           Management                              *
     ********************************************************************/

    // add whitelist
    function addWhitelists(address[] calldata addrs)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < addrs.length; i++) {
            whitelist[addrs[i]] = true;
        }
    }

    // remove whitelist
    function removeWhitelists(address[] calldata addrs)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < addrs.length; i++) {
            whitelist[addrs[i]] = false;
        }
    }

     /********************************************************************
     *                          Override ERC20                           *
     ********************************************************************/

    function initialize(string memory name_, string memory symbol_, address _pvsAddress) public initializer {
        __Ownable_init();
        _name = name_;
        _symbol = symbol_;
        pvsAddress = _pvsAddress;
    }

    function name() external view override returns (string memory) {
        return _name;
    }

    function symbol() external view override returns (string memory) {
        return _symbol;
    }

    function totalSupply() external view override returns (uint256) {
        return totalSupplyAtCheckpoint;
    }

    //balance of tkt at last checkpoint, not including 
    function balanceOf(address _staker) external view override returns (uint256) {
        return tktBalanceAtCheckpoint[_staker] + calculateIncrement(_staker);
    }

    function burn(address _ticketOwner, uint256 _amount) external override onlyWhiteList {
        updateCheckpoint(_ticketOwner);
        require(tktBalanceAtCheckpoint[_ticketOwner] >= _amount, "Your ticket balance is insufficient");
        tktBalanceAtCheckpoint[_ticketOwner] -= _amount;
        totalSupplyAtCheckpoint -= _amount;

        emit Transfer(_ticketOwner, address(0), _amount);
        emit TicketBurned(_ticketOwner, msg.sender, _amount);
    }

    function mint(address _ticketOwner, uint256 _amount) external override onlyWhiteList {
        tktBalanceAtCheckpoint[_ticketOwner] += _amount;
        totalSupplyAtCheckpoint += _amount;

        emit Transfer(address(0), _ticketOwner, _amount);
        emit TicketMinted(msg.sender, _ticketOwner, _amount);
    }

    /********************************************************************
     *                          Stake Functions                         *
     ********************************************************************/

    // C * s(cp) * (t - t(cp))
    function calculateIncrement(address _staker) internal view returns (uint256) {
        uint256 _last = checkpointTime[_staker];
        uint256 timeInterval = block.timestamp - _last;
        return PRODUCT_FACTOR * pvsBalance[_staker] * timeInterval;
    }

    //check & update # of TKT at current timestamp
    //now v(t) = v(cp) + C * s(cp) * (t - t(cp))
    function updateCheckpoint(address _staker) internal returns (uint256) {
        uint256 increment = calculateIncrement(_staker);

        tktBalanceAtCheckpoint[_staker] += increment;
        checkpointTime[_staker] = block.timestamp;

        emit Transfer(address(0), _staker, increment);

        totalSupplyAtCheckpoint += increment;
        return tktBalanceAtCheckpoint[_staker];
    }

    //stake more PVS 
    function stake(uint256 amount) external {
        uint256 allowAmt = IERC20(pvsAddress).allowance(msg.sender, address(this));
        require(allowAmt >= amount, "Insufficient PVS allowance to stake");

        updateCheckpoint(msg.sender);
        pvsBalance[msg.sender] += amount;

        IERC20(pvsAddress).safeTransferFrom(msg.sender, address(this), amount);
    }

    //withdraw PVS 
    function withdraw(uint256 amount) external {
        require(pvsBalance[msg.sender] >= amount, "Your PVS balance is insufficient");

        updateCheckpoint(msg.sender);
        pvsBalance[msg.sender] -= amount;

        IERC20(pvsAddress).safeTransfer(msg.sender, amount);
    }
}
