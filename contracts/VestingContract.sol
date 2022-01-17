//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract VestingContract {
    using SafeERC20 for IERC20;

    address public manager;

    address public tokenAddress;

    mapping(address => uint256) public beneficiaryProportion;
    mapping(address => uint256) public released;
    uint256 totalReleased;

    // Timing related constants (unix time).
    uint256 public startSecond /*= 1000000000*/;
    uint256[] public stageSecond /*= [0, 20000, 40000, 60000]*/;

    /**
     * Unlock proportion in corresponding stage.
     */
    uint256[] public unlockProportion /*= [0, 100, 300, 600]*/;

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
        address[] memory _beneficiaries,
        uint256[] memory _proportions,
        uint256 _start,
        uint256[] memory _stages,
        uint256[] memory _unlockProportion
    ) {
        manager = _manager;
        tokenAddress = _tokenAddress;

        require(_beneficiaries.length == _proportions.length);
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            beneficiaryProportion[_beneficiaries[i]] = _proportions[i];
        }

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

    function release() public {
        require(
            beneficiaryProportion[msg.sender] != 0,
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
            ((IERC20(tokenAddress).balanceOf(address(this)) + totalReleased) *
                vestingProportionSchedule(timestamp) *
                beneficiaryProportion[beneficiary]) / 1_000_000;
    }

    /**
     * Returns scheduled vest proportion of all beneficiaries.
     * Return between [0, 1000] since floating numbers are not supported.
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
        return 1000;
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
        require(beneficiaryProportion[_originalBeneficiary] != 0, "Not a beneficiary.");
        require(beneficiaryProportion[_newBeneficiary] == 0, "The new beneficiary already exists.");

        require(msg.sender == _originalBeneficiary || msg.sender == manager, "Unauthorized request.");

        emit BeneficiaryChanged(_originalBeneficiary, _newBeneficiary, msg.sender);

        beneficiaryProportion[_newBeneficiary] = beneficiaryProportion[_originalBeneficiary];
        beneficiaryProportion[_originalBeneficiary] = 0;
        
        released[_newBeneficiary] = released[_originalBeneficiary];
        released[_originalBeneficiary] = 0;
    }
}
