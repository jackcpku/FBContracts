//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract VestingPPN is IERC721Receiver{
    using SafeERC20 for IERC20;

    // manager of vesting
    address public manager;

    // the target NFT for vesting
    address public ppnAddress;
    
    // total released nft
    uint256 totalReleased;

    /**
     * Vesting schedule parameters
     *
     * periodStartTime: Each vesting period's startTime (in Unix timestamp)
     * unlockQuantity: Unlocked Quantity of nft
     *
     * The lengths of `periodStartTime` and `unlockQuantity` are the same 
     * For example, in the case of  
     *      periodStartTime = [1647000000, 1747000000, 1847000000] 
     *      unlockQuantity = [2000, 4000, 8000],
     *
     * - timestamp < `1647000000`, no nft were unlocked
     * - `1647000000` <= timestamp < `1747000000`, tokenId in [1, 2000] were unlocked
     * - `1747000000` <= timestamp < `1847000000`, tokenId in [1, 4000] were unlocked
     * - `1847000000` <= timestamp, tokenId in [1, 8000] were unlocked
     */
    uint256[] public periodStartTime;
    uint256[] public unlockQuantity;

    // Manager changed from currentManager to newManager.
    event TransferManagement(address indexed currentManager, address indexed newManager);

    modifier onlyManager() {
        require(msg.sender == manager, "VestingPPN: not manager");
        _;
    }

    constructor(
        address _manager,
        address _ppnAddress,
        uint256[] memory _periodStartTime,
        uint256[] memory _unlockQuantity
    ) {
        manager = _manager;
        ppnAddress = _ppnAddress;

        require(_periodStartTime.length == _unlockQuantity.length,  "VestingPPN: array not match");
        periodStartTime = _periodStartTime;
        unlockQuantity = _unlockQuantity;
    }

    function transferManagement(address _newManager) public onlyManager {
        emit TransferManagement(manager, _newManager);

        manager = _newManager;
    }

    function maxUnlockId() public view returns (uint256) {
        if (block.timestamp < periodStartTime[0]) {
            return 0;
        }
        //todo optimize
        for (uint256 i = 1; i < periodStartTime.length; i++) {
            if (block.timestamp < periodStartTime[i]) {
                return unlockQuantity[i - 1];
            }
        }
        return unlockQuantity[unlockQuantity.length - 1];
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
            IERC721(ppnAddress).ownerOf(_tokenId) == address(this),
            "VestingNFT: nft not owned by contract"
        );

        require(
            _tokenId <= maxUnlockId(),
            "VestingNFT: nft has not been released"
        );

        totalReleased++;

        IERC721(ppnAddress).safeTransferFrom(
            address(this),
            _receiver,
            _tokenId
        );
    }

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        //todo  
        return this.onERC721Received.selector;
    }
}
