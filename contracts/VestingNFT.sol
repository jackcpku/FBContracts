//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract VestingNFT {
    using SafeERC20 for IERC20;

    // manager of vesting
    address public manager;

    // the target NFT for vesting
    address public tokenAddress;
    
    // total released nft
    uint256 totalReleased;

    /**
     * Vesting schedule parameters
     *
     * startSecond: vesting start time (in Unix timestamp)
     * periodSecond: Each vesting stage (in second after `startSecond`)
     * unlockQuantity: Unlocked Quantity of nft
     *
     * The lengths of `periodSecond` and `unlockQuantity` are the same 
     * For example, in the case of periodSecond = [0, 1000, 2000] and unlockQuantity = [2000, 4000, 8000],
     * - timestamp < `startSecond + 0`, no nft are unlocked
     * - `startSecond + 0` <= timestamp < `startSecond + 1000`, tokenId in [1, 2000] are unlocked
     * - `startSecond + 1000` <= timestamp < `startSecond + 2000`, tokenId in [1, 4000] are unlocked
     * - `startSecond + 2000` <= timestamp, tokenId in [1, 8000] are unlocked
     */
    uint256 public startSecond;
    uint256[] public periodSecond;
    uint256[] public unlockQuantity;

    // Manager changed from currentManager to newManager.
    event TransferManagement(address indexed currentManager, address indexed newManager);

    modifier onlyManager() {
        require(msg.sender == manager, "Unauthorized");
        _;
    }

    constructor(
        address _manager,
        address _tokenAddress,
        uint256 _start,
        uint256[] memory _periods,
        uint256[] memory _unlockQuantity
    ) {
        manager = _manager;
        tokenAddress = _tokenAddress;

        startSecond = _start;
        require(_periods.length == _unlockQuantity.length);

        for (uint256 i = 0; i < _periods.length; i++) {
            periodSecond.push(_periods[i]);
            unlockQuantity.push(_unlockQuantity[i]);
        }
    }

    function transferManagement(address _newManager) public onlyManager {
        emit TransferManagement(manager, _newManager);

        manager = _newManager;
    }

    function maxUnlockId() public view returns (uint256) {
        for (uint256 i = 0; i < periodSecond.length; i++) {
            if ((startSecond + periodSecond[i]) > block.timestamp) {
                return unlockQuantity[i];
            }
        }
        return 0;
    }

    // claim batch
    function claimBatch(uint256[] calldata _tokenIds, address _receiver) external onlyManager {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            claim(_tokenIds[i], _receiver);
        }
    }

    // claim nft 
    function claim(uint256 _tokenId, address _receiver) public onlyManager {
        require(
            IERC721(tokenAddress).ownerOf(_tokenId) == address(this),
            "VestingNFT: nft not owned by contract"
        );

        require(
            _tokenId <= maxUnlockId(),
            "VestingNFT: nft has not been released"
        );

        totalReleased++;

        IERC721(tokenAddress).safeTransferFrom(
            address(this),
            _receiver,
            _tokenId
        );
    }
}
