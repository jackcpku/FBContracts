//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./ERC1363.sol";

/**
 * This Contract is designed for staking our platform token:PVS to generate & manage our voting ticket:TKT
 * 1. 
 * 2. 
 * 3. 
 * 4. 
 */
contract StakingPVSContract is ERC20, OwnableUpgradeable, ERC1363Spender, ERC1363 {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    // the target ERC20 token for staking
    address public pvsAddress;

    // All whitelisted TKT receiver  
    EnumerableSet.AddressSet private whitelistReceiver; 

    //factor
    uint256 public constant PRODUCT_FACTOR = 10_000; 

    // last checkpoint time
    mapping (address => uint256) public previousCheckpointTime;	

    // # of pvs at last checkpoint || now checkpoint
    // (if any change between this time interval , the pvs Balance will be updated automatically)
    mapping (address => uint256) public pvsBalance; 

    // # of tkt at last checkpoint
    mapping (address => uint256) public tktBalance; 

    //[owner][spender] = allowed amount
    mapping(address => mapping(address => uint)) allowed;

     /********************************************************************
     *                           Management                                 *
     ********************************************************************/

    // add whitelist
    function addWhitelists(address[] calldata addrs)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < addrs.length; i++) {
            whitelistReceiver.add(addrs[i]);
        }
    }
    
    // remove whitelist
    function removeWhitelists(address[] calldata addrs)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < addrs.length; i++) {
            whitelistReceiver.remove(addrs[i]);
        }
    }

     /********************************************************************
     *                          Override                                 *
     ********************************************************************/

    constructor(address _admin, address _pvsAddress) ERC20("TicketForVoting", "TKT") {
        uint256 total = 1_000_000_000 * 10**18;
        _mint(_admin, total);
        tktBalance[_admin] = total;
        pvsAddress = _pvsAddress;
    }

    //
    function balanceOf(address account) public view override returns (uint256) {
        return tktBalance[account];
    }

    function transfer(address _to, uint256 _value) public override returns (bool) {    
        require(verifyTransfer(_to), "Transfer is not valid");   
        require(_to != address(0));
        require(_value <= tktBalance[msg.sender]);   
        tktBalance[msg.sender] -= _value;
        tktBalance[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        return true;  
    }

    // function approve(address _spender, uint256 _value) public override returns (bool success) {
    //     require(tktBalance[msg.sender] >= _value);
    //     require(_value > 0);
    //     //sender to spender at most value
    //     allowed[msg.sender][_spender] = _value;
    //     emit Approval(msg.sender, _spender, _value);
    //     return true;
    // }

    // function allowance(address _tokenOwner, address _spender) public view override returns (uint256 remaining) {
    //     return allowed[_tokenOwner][_spender];
    // }transferFrom

    function transferFrom(address _from, address _to, uint256 _value) public override returns (bool success) {
        require(verifyTransfer(_to), "Transfer is not valid");   
        require(allowed[_from][_to] >= _value);
        require(tktBalance[_from] >= _value);

        tktBalance[_to] += _value;
        tktBalance[_from] -= _value;
        allowed[_from][_to] -= _value;
        return true;
    }

    function verifyTransfer(address _to) public view returns(bool) {
        return whitelistReceiver.contains(_to);
    }

    function onApprovalReceived(
        address owner, 
        uint256 value, 
        bytes memory data
    ) external override returns (bytes4) {
        
    }


    //override
    function _msgSender() internal view override(Context, ContextUpgradeable) returns (address) {
        return msg.sender;
    }

    //override
    function _msgData() internal pure  override(Context, ContextUpgradeable) returns (bytes calldata) {
        return msg.data;
    }

    /********************************************************************
     *                          Stake Functions                         *
     ********************************************************************/

    // now v(t) = v(cp) + C * s(cp) * (t - t(cp))
    function ticketCount(address _staker) public returns (uint256) {
        uint256 _last = previousCheckpointTime[_staker];
        uint256 timeInterval = block.timestamp - _last;
        tktBalance[_staker] += PRODUCT_FACTOR * pvsBalance[_staker] * timeInterval;
        //todo
        previousCheckpointTime[_staker] = block.timestamp;
        return tktBalance[_staker];
    }

    //stake more PVS on our Addr
    function stake(uint256 amount) external {
        uint256 allowance = IERC20(pvsAddress).allowance(msg.sender, address(this));
        require(allowance >= amount, "Insufficient PVS allowance to stake");

        previousCheckpointTime[msg.sender] = block.timestamp;
        pvsBalance[msg.sender] += amount;

        IERC20(pvsAddress).safeTransferFrom(msg.sender, address(this), amount);
    }

    //withdraw PVS from our Addr
    function withdraw(uint256 amount) external {
        require(pvsBalance[msg.sender] >= amount, "Your PVS alance is insufficient");

        previousCheckpointTime[msg.sender] = block.timestamp;
        pvsBalance[msg.sender] -= amount;

        IERC20(pvsAddress).safeTransfer(msg.sender, amount);
    }
}
