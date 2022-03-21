//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract PPNLocker is IERC721Receiver, Ownable {
    // manager of vesting
    address public manager;

    // the target NFT for vesting
    address public ppnAddress;

    // total released nft
    uint256 totalReleased;

    /**
     * lock schedule parameters
     *
     * periodStartTime: Each lock period's startTime (in Unix timestamp)
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

    constructor(
        address _manager,
        address _ppnAddress,
        uint256[] memory _periodStartTime,
        uint256[] memory _unlockQuantity
    ) {
        manager = _manager;
        ppnAddress = _ppnAddress;
        require(
            _periodStartTime.length == _unlockQuantity.length,
            "PPNLocker: array not match"
        );
        for (uint256 i = 1; i < _periodStartTime.length; i++) {
            require(
                _periodStartTime[i] > _periodStartTime[i - 1],
                "PPNLocker: invalid _periodStartTime"
            );
            require(
                _unlockQuantity[i] > _unlockQuantity[i - 1],
                "PPNLocker: invalid _unlockQuantity"
            );
        }

        periodStartTime = _periodStartTime;
        unlockQuantity = _unlockQuantity;
    }

    function maxUnlockId() public view returns (uint256) {
        if (block.timestamp < periodStartTime[0]) {
            return 0;
        }
        for (uint256 i = 1; i < periodStartTime.length; i++) {
            if (block.timestamp < periodStartTime[i]) {
                return unlockQuantity[i - 1];
            }
        }
        return unlockQuantity[unlockQuantity.length - 1];
    }

    function claimBatch(
        uint256 _startId,
        uint256 _endId,
        address _receiver
    ) external onlyOwner {
        require(
            address(_receiver) != address(0),
            "PPNLocker: zero address is not allowed"
        );
        require(
            _startId > 0 && _startId <= _endId,
            "PPNLocker: _startId is invalid"
        );
        require(
            _endId <= maxUnlockId(),
            "PPNLocker: nft has not been released"
        );

        for (uint256 _tokenId = _startId; _tokenId <= _endId; _tokenId++) {
            IERC721(ppnAddress).safeTransferFrom(
                address(this),
                _receiver,
                _tokenId
            );
        }
    }

    function onERC721Received(
        address, /*operator*/
        address, /*from*/
        uint256, /*tokenId*/
        bytes calldata /*data*/
    ) external view override returns (bytes4) {
        require(msg.sender == ppnAddress, "PPNLocker: only accept ppn");
        return
            bytes4(
                keccak256("onERC721Received(address,address,uint256,bytes)")
            );
    }
}
