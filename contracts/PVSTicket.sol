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

contract PVSTicket is IERC20Upgradeable, IPVSTicket, AccessControlUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // the target ERC20 token for staking
    address public pvsAddress;
    
    // total staked pvs 
    uint256 public totalStaked;

    // totalSupply of ticket token at the latest checkpoint 
    uint256 public totalSupplyAtCheckpoint;

    //factor
    uint256 public constant PRODUCT_FACTOR = 10_000; 

    // last checkpoint time
    mapping (address => uint256) public checkpointTime;	

    // # of pvs at the latest checkpoint 
    // (if any change between this time interval , the pvs Balance will be updated automatically)
    mapping (address => uint256) public staked; 

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

    function initialize(address _pvsAddress) public initializer {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        pvsAddress = _pvsAddress;
    }

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function name() external pure returns (string memory) {
        return "PVSTicket";
    }

    function symbol() external pure returns (string memory) {
        return "PVST";
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

    function transfer(address /*recipient*/, uint256 /*amount*/) external pure override returns (bool) {
        require(false, "Ticket transfer is not allowed!");
        return false;
    }

    function allowance(address /*owner*/, address /*spender*/) external pure override returns (uint256) {
        return 0;
    }

    function approve(address /*spender*/, uint256 /*amount*/) external pure override returns (bool) {
        return false;
    }

    function transferFrom(address /*sender*/, address /*recipient*/, uint256 /*amount*/) external pure override returns (bool) {
        require(false, "Ticket transfer is not allowed!");
        return false;
    }

     /********************************************************************
     *                          Override PVSTicket                       *
     ********************************************************************/

    function burn(address _ticketOwner, uint256 _amount) external override onlyRole(TICKET_BURNER_ROLE) {
        updateCheckpoint(_ticketOwner);
        require(tktBalanceAtCheckpoint[_ticketOwner] >= _amount, "Ticket balance is insufficient");
        tktBalanceAtCheckpoint[_ticketOwner] -= _amount;
        totalSupplyAtCheckpoint -= _amount;

        emit Transfer(_ticketOwner, address(0), _amount);
        emit TicketBurned(_ticketOwner, msg.sender, _amount);
    }

    function mint(address _ticketOwner, uint256 _amount) external override onlyRole(TICKET_MINTER_ROLE) {
        tktBalanceAtCheckpoint[_ticketOwner] += _amount;
        totalSupplyAtCheckpoint += _amount;

        emit Transfer(address(0), _ticketOwner, _amount);
        emit TicketMinted(_ticketOwner, msg.sender, _amount);
    }

    /********************************************************************
     *                          Stake Functions                         *
     ********************************************************************/

    // C * s(cp) * (t - t(cp))
    function calculateIncrement(address _staker) public view returns (uint256) {
        uint256 _last = checkpointTime[_staker];
        uint256 timeInterval = block.timestamp - _last;
        return PRODUCT_FACTOR * staked[_staker] * timeInterval;
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
        staked[msg.sender] += amount;
        totalStaked += amount;
    }

    //withdraw PVS 
    function withdraw(uint256 amount) external {
        require(staked[msg.sender] >= amount, "Not Allowed! The withdraw amount exceeded the staked amount");

        updateCheckpoint(msg.sender);
        staked[msg.sender] -= amount;
        totalStaked -= amount;

        IERC20Upgradeable(pvsAddress).safeTransfer(msg.sender, amount);
    }

    function pvsAmount(address _staker) external view returns (uint256) {
        return staked[_staker];
    }
}
