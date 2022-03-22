//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./IPVSTicket.sol";

/**
 * This Contract is designed for staking our platform token:PVS to generate & manage our voting ticket:PVST
 * 1. Generate PVST according to the amount of PVS: The core principle is that a unit amount of PVS staking generates a fixed number of tickets per unit time.
 *      So it is necessary to calculate the integral of the PVS staking amount over time.
 * 2. PVST implements the SimpleIERC20 standard, but transfers are strictly limited, and only whitelisted addresses can mint or burn PVST.
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
    
    /**
     * Returns the totalSupply of ticket token at the latest checkpoint 
     * @notice (Does not include incremental but unminted parts from the latest checkpoint to the present)
     */
    function totalSupply() external view override returns (uint256) {
        return totalSupplyAtCheckpoint;
    }

    /**
     * Return the balance of one staker’s ticket at present
     * @notice including incremental but unminted parts from the latest checkpoint to the present
     */
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
    /**
     * Generate PVST according to the amount of PVS: The core principle is that a unit amount of PVS staking generates a fixed number of tickets per unit time.
     * So it is necessary to calculate the integral of the PVS staking amount over time.
     * For each address, define the concept of a checkpoint cp
     *   1. Record the time t(cp) of the checkpoint and the integral (ie ticket) v(cp)  at that time
     *   2. It is required that from the last checkpoint to the current time, the amount of PVS staked by this address is fixed and recorded as s(cp).
     *   3. Then the current ticket balance of each address `v(t) = v(cp) + ConstFactor * s(cp) * (t - t(cp))`
     */

    /**
     * Calculate the increment of the staker's ticket from the most recent checkpoint to the present
     * Increment = C * s(cp) * (t - t(cp))
     */
    function calculateIncrement(address _staker) public view returns (uint256) {
        uint256 _last = checkpointTime[_staker];
        uint256 timeInterval = block.timestamp - _last;
        return PRODUCT_FACTOR * staked[_staker] * timeInterval;
    }

    /**
     * Check & update # of PVST at current timestamp
     * When the amount of staking changes, it is necessary to update the checkpoint in time: after staking and before withdrawal
     *    v(t) = v(cp) + C * s(cp) * (t - t(cp))
     * 1. calculate increment from the latest checkpoint to the present
     * 2. add the increment to the ticket balance of the ticketOwner
     * 3. update the ticketOwner’s last checkpointTime to present
     * 4. emit Transfer event
     */
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
