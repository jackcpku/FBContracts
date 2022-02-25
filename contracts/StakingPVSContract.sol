//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "./IERC1363.sol";

/**
 * This Contract is designed for staking our platform token:PVS to generate & manage our voting ticket:TKT
 * 1. generate TKT accroding to the amount of PVS
 * 2. TKT implemented ERC20 and ERC1363 standards, but transfers are restricted, and only whitelisted addresses can transfer
 * 3. 
 * 4. 
 */
contract StakingPVSContract is OwnableUpgradeable, IERC1363Spender, IERC1363, ERC20Upgradeable {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using Address for address;

    bytes4 internal constant _INTERFACE_ID_ERC1363_SPENDER = 0x7b04a2d0;

    // the target ERC20 token for staking
    address public pvsAddress;

    // All whitelisted TKT receiver  
    EnumerableSet.AddressSet private whitelistReceiver; 

    //factor
    uint256 public constant PRODUCT_FACTOR = 10_000; 

    // last checkpoint time
    mapping (address => uint256) public checkpointTime;	

    // # of pvs at last checkpoint || now checkpoint
    // (if any change between this time interval , the pvs Balance will be updated automatically)
    mapping (address => uint256) public pvsBalance; 

    // # of tkt at last checkpoint
    mapping (address => uint256) public tktBalanceAtCheckpoint; 

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
     *                          Override ERC20                           *
     ********************************************************************/

    // constructor(address _admin, address _pvsAddress) ERC20("TicketForVoting", "TKT") {
    //     // _mint(_admin, 0);
    //     pvsAddress = _pvsAddress;

    function initialize(string memory name, string memory symbol, address _pvsAddress) public initializer {
        __Ownable_init();
        __ERC20_init(name, symbol);
        pvsAddress = _pvsAddress;
    }

    function totalSupply() public pure override returns (uint256) {
        return type(uint256).max;
    }

    //balance of tkt at last checkpoint, not including 
    function balanceOf(address _staker) public view override returns (uint256) {
        return tktBalanceAtCheckpoint[_staker] + calculateIncrement(_staker);
    }
    
    function transfer(address _to, uint256 _value) public override returns (bool) {  
        updateCheckpoint(msg.sender);
        require(verifyTransfer(_to), "Transfer is not valid");   
        require(_to != address(0));
        require(_value <= tktBalanceAtCheckpoint[msg.sender]);   
        tktBalanceAtCheckpoint[msg.sender] -= _value;
        tktBalanceAtCheckpoint[_to] += _value;
        // emit Transfer(msg.sender, _to, _value);
        return true;  
    }

    function approve(address _spender, uint256 _value) public override returns (bool success) {
        updateCheckpoint(msg.sender);
        require(tktBalanceAtCheckpoint[msg.sender] >= _value);
        require(_value > 0);
        allowed[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    function allowance(address _tokenOwner, address _spender) public view override returns (uint256 remaining) {
        return allowed[_tokenOwner][_spender];
    }

    function transferFrom(address _from, address _to, uint256 _value) public override returns (bool success) {
        updateCheckpoint(msg.sender);
        require(verifyTransfer(_to), "Transfer is not valid");   
        require(allowed[_from][_to] >= _value);
        require(tktBalanceAtCheckpoint[_from] >= _value);

        tktBalanceAtCheckpoint[_to] += _value;
        tktBalanceAtCheckpoint[_from] -= _value;
        allowed[_from][_to] -= _value;
        return true;
    }

    function verifyTransfer(address _to) public view returns(bool) {
        return whitelistReceiver.contains(_to);
    }

    /********************************************************************
     *                          Override ERC1363                           *
     ********************************************************************/

    /**
    * @notice Transfer tokens from `msg.sender` to another address and then call `onTransferReceived` on receiver
    * @param to address The address which you want to transfer to
    * @param value uint256 The amount of tokens to be transferred
    * @return true unless throwing
    */
    function transferAndCall(address to, uint256 value) external override returns (bool) {
        return true;
    }

    /**
    * @notice Transfer tokens from `msg.sender` to another address and then call `onTransferReceived` on receiver
    * @param to address The address which you want to transfer to
    * @param value uint256 The amount of tokens to be transferred
    * @param data bytes Additional data with no specified format, sent in call to `to`
    * @return true unless throwing
    */
    function transferAndCall(address to, uint256 value, bytes memory data) external override returns (bool) {
        return true;
    }

    /**
    * @notice Transfer tokens from one address to another and then call `onTransferReceived` on receiver
    * @param from address The address which you want to send tokens from
    * @param to address The address which you want to transfer to
    * @param value uint256 The amount of tokens to be transferred
    * @return true unless throwing
    */
    function transferFromAndCall(address from, address to, uint256 value) external override returns (bool) {
        return true;
    }


    /**
    * @notice Transfer tokens from one address to another and then call `onTransferReceived` on receiver
    * @param from address The address which you want to send tokens from
    * @param to address The address which you want to transfer to
    * @param value uint256 The amount of tokens to be transferred
    * @param data bytes Additional data with no specified format, sent in call to `to`
    * @return true unless throwing
    */
    function transferFromAndCall(address from, address to, uint256 value, bytes memory data) external override returns (bool) {
        return true;
    }

    /**
    * @notice Approve the passed address to spend the specified amount of tokens on behalf of msg.sender
    * and then call `onApprovalReceived` on spender.
    * @param spender address The address which will spend the funds
    * @param value uint256 The amount of tokens to be spent
    */
    function approveAndCall(address spender, uint256 value) public override returns (bool) {
        return approveAndCall(spender, value, "");
    }

    /**
    * @notice Approve the passed address to spend the specified amount of tokens on behalf of msg.sender
    * and then call `onApprovalReceived` on spender.
    * @param spender address The address which will spend the funds
    * @param value uint256 The amount of tokens to be spent
    * @param data bytes Additional data with no specified format, sent in call to `spender`
    */
    function approveAndCall(address spender, uint256 value, bytes memory data) public override returns (bool) {
        approve(spender, value);
        require(_checkAndCallApprove(spender, value, data), "ERC1363: _checkAndCallApprove reverts");
        return true;
    }

     /**
     * @dev Internal function to invoke `onApprovalReceived` on a target address
     *  The call is not executed if the target address is not a contract
     * @param spender address The address which will spend the funds
     * @param value uint256 The amount of tokens to be spent
     * @param data bytes Optional data to send along with the call
     * @return whether the call correctly returned the expected magic value
     */
    function _checkAndCallApprove(
        address spender,
        uint256 value,
        bytes memory data
    ) internal virtual returns (bool) {
        if (!spender.isContract()) {
            return false;
        }
        //todo
        bytes4 retval = IERC1363Spender(spender).onApprovalReceived(_msgSender(), value, data);
        return (retval == IERC1363Spender(spender).onApprovalReceived.selector);
    }    

    //IERC1363Spender
    function onApprovalReceived(
        address owner, 
        uint256 value, 
        bytes memory data
    ) external override returns (bytes4) {
        
        //todo
        return _INTERFACE_ID_ERC1363_SPENDER;
    }



    /********************************************************************
     *                          Stake Functions                         *
     ********************************************************************/

    // C * s(cp) * (t - t(cp))
    function calculateIncrement(address _staker) private view returns (uint256) {
        uint256 _last = checkpointTime[_staker];
        uint256 timeInterval = block.timestamp - _last;
        return PRODUCT_FACTOR * pvsBalance[_staker] * timeInterval;
    }

    //check & update # of TKT at current timestamp
    //now v(t) = v(cp) + C * s(cp) * (t - t(cp))
    function updateCheckpoint(address _staker) public returns (uint256) {
        tktBalanceAtCheckpoint[_staker] += calculateIncrement(_staker);
        checkpointTime[_staker] = block.timestamp;
        return tktBalanceAtCheckpoint[_staker];
    }

    //stake more PVS on our Addr
    function stake(uint256 amount) external {
        uint256 allowAmt = IERC20(pvsAddress).allowance(msg.sender, address(this));
        require(allowAmt >= amount, "Insufficient PVS allowance to stake");

        updateCheckpoint(msg.sender);
        pvsBalance[msg.sender] += amount;

        IERC20(pvsAddress).safeTransferFrom(msg.sender, address(this), amount);
    }

    //withdraw PVS from our Addr
    function withdraw(uint256 amount) external {
        require(pvsBalance[msg.sender] >= amount, "Your PVS alance is insufficient");

        updateCheckpoint(msg.sender);
        pvsBalance[msg.sender] -= amount;

        IERC20(pvsAddress).safeTransfer(msg.sender, amount);
    }
}
