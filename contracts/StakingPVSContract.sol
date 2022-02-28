//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./interfaces/IPVSTicket.sol";

/**
 * This Contract is designed for staking our platform token:PVS to generate & manage our voting ticket:TKT
 * 1. Generate TKT accroding to the amount of PVS
 * 2. TKT implemented SimpleIERC20 standards, but transfers were restricted, and only whitelisted addresses can mint or burn
 */

contract StakingPVSContract is IERC20Upgradeable, IPVSTicket, AccessControlUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    string private _name;
    string private _symbol;

    // the target ERC20 token for staking
    address public pvsAddress;

    uint256 public totalSupplyAtCheckpoint;

    //factor
    uint256 public constant PRODUCT_FACTOR = 10_000; 

    // last checkpoint time
    mapping (address => uint256) public checkpointTime;	

    // # of pvs at last checkpoint || now checkpoint
    // (if any change between this time interval , the pvs Balance will be updated automatically)
    mapping (address => uint256) public pvsBalance; 

    // # of tkt at last checkpoint
    mapping (address => uint256) public tktBalanceAtCheckpoint; 

    /**
     * The role responsible for mint ticket.
     */
    bytes32 public constant TICKET_MINTER_ROLE = keccak256("TICKET_MINTER_ROLE");
    
    /**
     * The role responsible for burn ticket.
     */
    bytes32 public constant TICKET_BURNER_ROLE = keccak256("TICKET_BURNER_ROLE");

     /********************************************************************
     *                           Management                              *
     ********************************************************************/

    function initialize(string memory name_, string memory symbol_, address _pvsAddress) public initializer {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _name = name_;
        _symbol = symbol_;
        pvsAddress = _pvsAddress;
    }

    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    /********************************************************************
     *                      Admin-only functions                        *
     ********************************************************************/

    /**
     * Add a _burner
     * @notice Only the admin can call this function.
     */
    function addBurner(address _burner) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(TICKET_BURNER_ROLE, _burner);
    }

    /**
     * Remove a _burner
     * @notice Only the admin can call this function.
     */
    function removeBurner(address _burner) public onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _revokeRole(TICKET_BURNER_ROLE, _burner);
    }

    /**
     * Add a _miner
     * @notice Only the admin can call this function.
     */
    function addMiner(address _miner) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(TICKET_MINTER_ROLE, _miner);
    }

    /**
     * Remove a _miner
     * @notice Only the admin can call this function.
     */
    function removeMiner(address _miner) public onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _revokeRole(TICKET_MINTER_ROLE, _miner);
    }

     /********************************************************************
     *                          Override IERC20                          *
     ********************************************************************/

    function totalSupply() external view override returns (uint256) {
        return totalSupplyAtCheckpoint;
    }

    //balance of tkt at last checkpoint, not including 
    function balanceOf(address _staker) external view override returns (uint256) {
        return tktBalanceAtCheckpoint[_staker] + calculateIncrement(_staker);
    }

    function transfer(address recipient, uint256 amount) external pure override returns (bool) {
        return true;
    }

    function allowance(address owner, address spender) external pure override returns (uint256) {
        return 0;
    }

    function approve(address spender, uint256 amount) external pure override returns (bool) {
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external pure override returns (bool) {
        return true;
    }

     /********************************************************************
     *                          Override PVSTicket                       *
     ********************************************************************/

    function burn(address _ticketOwner, uint256 _amount) external override onlyRole(TICKET_BURNER_ROLE) {
        updateCheckpoint(_ticketOwner);
        require(tktBalanceAtCheckpoint[_ticketOwner] >= _amount, "Your ticket balance is insufficient");
        tktBalanceAtCheckpoint[_ticketOwner] -= _amount;
        totalSupplyAtCheckpoint -= _amount;

        emit Transfer(_ticketOwner, address(0), _amount);
        emit TicketBurned(_ticketOwner, msg.sender, _amount);
    }

    function mint(address _ticketOwner, uint256 _amount) external override onlyRole(TICKET_MINTER_ROLE) {
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
        IERC20Upgradeable(pvsAddress).safeTransferFrom(msg.sender, address(this), amount);
        
        updateCheckpoint(msg.sender);
        pvsBalance[msg.sender] += amount;
    }

    //withdraw PVS 
    function withdraw(uint256 amount) external {
        require(pvsBalance[msg.sender] >= amount, "Your PVS balance is insufficient");

        updateCheckpoint(msg.sender);
        pvsBalance[msg.sender] -= amount;

        IERC20Upgradeable(pvsAddress).safeTransfer(msg.sender, amount);
    }
}
