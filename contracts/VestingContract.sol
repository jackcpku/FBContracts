//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract VestingContract {
    using SafeERC20 for IERC20;

    uint256 public constant PROPORTION_BASE = 10_000;

    address public manager;

    address public tokenAddress;

    mapping(address => uint256) public beneficiaryAmount;
    mapping(address => uint256) public released;
    uint256 totalReleased;

    // Timing related constants (unix time).
    uint256 public startSecond /*= 1000000000*/;
    uint256[] public stageSecond /*= [0, 20000, 40000, 60000]*/;

    /**
     * Unlock proportion in corresponding stage.
     */
    uint256[] public unlockProportion /*= [0, 1000, 3000, 6000]*/;

    /**
     * A beneficiary pulled from the token pool.
     */
    event TokenReleased(address indexed beneficiary, uint256 amount);

    /**
     * Manager changed from currentManager to newManager.
     */
    event ManagementTransferred(address indexed currentManager, address indexed newManager);

    /**
     * Beneficiary changed from originalBeneficiary to newBeneficiary.
     */
    event BeneficiaryChanged(address indexed originalBeneficiary, address indexed newBeneficiary, address indexed executor);
 

    constructor(
        address _manager,
        address _tokenAddress,
        uint256 _start,
        uint256[] memory _stages,
        uint256[] memory _unlockProportion
    ) {
        manager = _manager;
        tokenAddress = _tokenAddress;

        startSecond = _start;
        require(_stages.length == _unlockProportion.length);
        for (uint256 i = 0; i < _stages.length; i++) {
            stageSecond.push(_stages[i]);
            unlockProportion.push(_unlockProportion[i]);
        }
    }

    function transferManagement(address _newManager) public {
        require(msg.sender == manager, "Unauthorized");

        emit ManagementTransferred(manager, _newManager);

        manager = _newManager;
    }

    function addBeneficiary(address _beneficiary, uint256 _amount) public {
        beneficiaryAmount[_beneficiary] = _amount;

        IERC20(tokenAddress).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
    }

    function release() public {
        require(
            beneficiaryAmount[msg.sender] != 0,
            "Only beneficiaries receive."
        );

        uint256 scheduledRelease = vestingAmountSchedule(
            msg.sender,
            block.timestamp
        );

        require(
            scheduledRelease > released[msg.sender],
            "Tokens not available."
        );

        uint256 releasable = scheduledRelease - released[msg.sender];

        released[msg.sender] += releasable;
        totalReleased += releasable;
        
        emit TokenReleased(msg.sender, releasable);

        // send ERC20 token to `msg.sender`.
        IERC20(tokenAddress).safeTransfer(
            msg.sender,
            releasable
        );
    }

    /**
     * The scheduled vest amount of a certain beneficiary.
     */
    function vestingAmountSchedule(address beneficiary, uint256 timestamp)
        public
        view
        returns (uint256 amount)
    {
        return
            (vestingProportionSchedule(timestamp) *
             beneficiaryAmount[beneficiary]) / PROPORTION_BASE;
    }

    /**
     * Returns scheduled vest proportion of all beneficiaries.
     * Return between [0, PROPORTION_BASE] since floating numbers are not supported.
     */
    function vestingProportionSchedule(uint256 timestamp)
        public
        view
        returns (uint256 nominator)
    {
        for (uint i = 0; i < stageSecond.length; i++) {
            if (timestamp < startSecond + stageSecond[i]) {
                return unlockProportion[i];
            }
        }
        return PROPORTION_BASE;
    }

    /**
     * Change beneficiary
     * @dev Only beneficiaries are supposed to call.
     * @notice The original beneficiary will not be able to pull after.
     */
    function changeBeneficiary(
        address _originalBeneficiary, 
        address _newBeneficiary
    ) 
        public 
    {
        require(beneficiaryAmount[_originalBeneficiary] != 0, "Not a beneficiary");
        require(beneficiaryAmount[_newBeneficiary] == 0, "The new beneficiary already exists");

        require(msg.sender == _originalBeneficiary || msg.sender == manager, "Unauthorized request");

        emit BeneficiaryChanged(_originalBeneficiary, _newBeneficiary, msg.sender);

        beneficiaryAmount[_newBeneficiary] = beneficiaryAmount[_originalBeneficiary];
        beneficiaryAmount[_originalBeneficiary] = 0;
        
        released[_newBeneficiary] = released[_originalBeneficiary];
        released[_originalBeneficiary] = 0;
    }
}
