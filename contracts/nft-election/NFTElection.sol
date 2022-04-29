// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "./IPVSTicket.sol";

contract NFTElection is
    Initializable,
    OwnableUpgradeable,
    IERC721ReceiverUpgradeable
{
    using SafeMath for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // The ticket token used for voting
    address public ticketAddress;

    address public serviceFeeRecipient;

    uint256 currentElectionId;

    // electionId => election information
    mapping(uint256 => ElectionInfo) public electionInfo;

    struct ElectionInfo {
        address tokenAddress;
        uint256 tokenIdLowerBound;
        uint256 tokenIdUpperBound;
        uint256 listingTime;
        uint256 expirationTime;
        uint256 fallbackPrice;
        // tokenId => price
        mapping(uint256 => uint256) price;
        // tokenId => voter => amount
        mapping(uint256 => mapping(address => uint256)) hasVoted;
        // tokenId => maxVoted
        mapping(uint256 => uint256) maxVoted;
        // tokenId => winner
        mapping(uint256 => address) winner;
        // tokenId => extendedExpirationTime
        // extendedExpirationTime keeps track of the extended duration (delta) of a ddl for each token
        mapping(uint256 => uint256) extendedExpirationTime;
        // Whether has been voted by any voter, the manager is allowed to cancel the election only if `voted` is `false`.
        bool voted;
        bool cancelled;
    }

    // cp of the nft
    mapping(address => address) manager;

    // PVS address
    address paymentTokenAddress;

    // Total margin of a voter, voter => amount
    mapping(address => uint256) margin;

    // Minimum PVS margin amount
    mapping(address => uint256) marginLocked;

    // Voting during [ddl - `saleEndDuration`, ddl) will extend DDL by `saleExtendDuration`
    // DDL can be extended no longer than `saleExtendDurationMax`
    uint256 constant saleEndDuration = 1 days;
    uint256 constant saleExtendDuration = 1 days;
    uint256 constant saleExtendDurationMax = 7 days;

    // Record the used [tokenIdLowerBound, tokenidUpperBound] ranges of an address
    mapping(address => uint256[2][]) usedRanges;

    event SetManager(
        address operator,
        address indexed tokenAddress,
        address indexed manager
    );

    event InitializeVote(
        address indexed manager,
        uint256 indexed electionId,
        address indexed tokenAddress,
        uint256 tokenIdLowerBound,
        uint256 tokenIdUpperBound,
        uint256 listingTime,
        uint256 expirationTime
    );

    event VoteToken(
        address indexed voter,
        uint256 indexed electionId,
        address tokenAddress,
        uint256 indexed tokenId,
        uint256 amount
    );

    event ExtendExpirationTime(
        uint256 indexed electionId,
        address tokenAddress,
        uint256 indexed tokenId
    );

    modifier onlyManager(address _tokenAddress) {
        require(
            msg.sender == manager[_tokenAddress] || msg.sender == owner(),
            "NFTElection: not manager"
        );
        _;
    }

    modifier requireTokenIdInElectionRange(
        uint256 _electionId,
        uint256 _tokenId
    ) {
        require(
            electionInfo[_electionId].tokenIdLowerBound <= _tokenId &&
                _tokenId <= electionInfo[_electionId].tokenIdUpperBound,
            "NFTElection: tokenId is not in election range"
        );
        _;
    }

    modifier notCancelled(uint256 _electionId) {
        require(
            !electionInfo[_electionId].cancelled,
            "NFTElection: election has been cancelled"
        );
        _;
    }

    function initialize(address _ticketAddress, address _pvsAddress)
        public
        initializer
    {
        __Ownable_init();
        ticketAddress = _ticketAddress;
        paymentTokenAddress = _pvsAddress;
    }

    // Called by owner.
    function setServiceFeeRecipient(address _recipient) public onlyOwner {
        serviceFeeRecipient = _recipient;
    }

    // Called by owner.
    function setManager(address _tokenAddress, address _manager)
        public
        onlyOwner
    {
        manager[_tokenAddress] = _manager;
        emit SetManager(msg.sender, _tokenAddress, _manager);
    }

    // Called by managers.
    // Set the same price for every NFTs of the same tokenAddress.
    function setPrice(uint256 _electionId, uint256 _price)
        public
        onlyManager(electionInfo[_electionId].tokenAddress)
        notCancelled(_electionId)
    {
        electionInfo[_electionId].fallbackPrice = _price;
    }

    // Called by managers.
    // Set the price of a single NFT.
    function setPrice(
        uint256 _electionId,
        uint256 _tokenId,
        uint256 _price
    )
        public
        onlyManager(electionInfo[_electionId].tokenAddress)
        notCancelled(_electionId)
        requireTokenIdInElectionRange(_electionId, _tokenId)
    {
        electionInfo[_electionId].price[_tokenId] = _price;
    }

    /**
     * @dev Called by managers.
     */
    function initializeVote(
        address _tokenAddress,
        uint256 _tokenIdLowerBound,
        uint256 _tokenIdUpperBound,
        uint256 _listingTime,
        uint256 _expirationTime
    ) public onlyManager(_tokenAddress) {
        require(
            _listingTime < _expirationTime,
            "NFTElection: invalid listingTime or expirationTime"
        );

        // Check if lower bound & uppwer bound are valid
        _requireValidTokenIdBounds(
            _tokenAddress,
            _tokenIdLowerBound,
            _tokenIdUpperBound
        );

        ElectionInfo storage info = electionInfo[currentElectionId];

        info.tokenAddress = _tokenAddress;
        info.tokenIdLowerBound = _tokenIdLowerBound;
        info.tokenIdUpperBound = _tokenIdUpperBound;
        info.listingTime = _listingTime;
        info.expirationTime = _expirationTime;

        usedRanges[_tokenAddress].push(
            [_tokenIdLowerBound, _tokenIdUpperBound]
        );

        emit InitializeVote(
            msg.sender,
            currentElectionId,
            _tokenAddress,
            _tokenIdLowerBound,
            _tokenIdUpperBound,
            _listingTime,
            _expirationTime
        );

        currentElectionId++;
    }

    function cancelVote(uint256 _electionId)
        external
        onlyManager(electionInfo[_electionId].tokenAddress)
        notCancelled(_electionId)
    {
        require(
            !electionInfo[_electionId].voted,
            "NFTElection: the election has started"
        );

        // Remove from usedRange
        uint256 usedRangesLength = usedRanges[
            electionInfo[_electionId].tokenAddress
        ].length;
        for (uint256 i = 0; i < usedRangesLength; i++) {
            if (
                usedRanges[electionInfo[_electionId].tokenAddress][i][0] ==
                electionInfo[_electionId].tokenIdLowerBound
            ) {
                if (i != usedRangesLength - 1) {
                    // Swap with the last item in the array
                    usedRanges[electionInfo[_electionId].tokenAddress][
                        i
                    ] = usedRanges[electionInfo[_electionId].tokenAddress][
                        usedRangesLength - 1
                    ];
                }
                // Remove the last item
                usedRanges[electionInfo[_electionId].tokenAddress].pop();

                electionInfo[_electionId].cancelled = true;

                return;
            }
        }
    }

    /**
     * Get the price of a single NFT.
     * @dev If the NFT has a specified price in `price`, return that price,
     * else return the whole collection's fallback price.
     */
    function getPrice(uint256 _electionId, uint256 _tokenId)
        public
        view
        notCancelled(_electionId)
        requireTokenIdInElectionRange(_electionId, _tokenId)
        returns (uint256)
    {
        // Check if tokenId is in the correct range
        require(
            electionInfo[_electionId].tokenIdLowerBound <= _tokenId &&
                _tokenId <= electionInfo[_electionId].tokenIdUpperBound,
            "NFTElection: tokenId is not in valid range"
        );

        uint256 singleItemPrice = electionInfo[_electionId].price[_tokenId];
        if (singleItemPrice > 0) {
            return singleItemPrice;
        } else {
            return electionInfo[_electionId].fallbackPrice;
        }
    }

    /**
     * When ex-voters didn't want their PVS locked in the margin account,
     * they call this function to withdraw their margin balance.
     *
     * @dev Called by voters.
     */
    function withdrawMargin(uint256 _amount) external {
        require(
            marginLocked[msg.sender] + _amount <= margin[msg.sender],
            "NFTElection: low margin balance"
        );
        margin[msg.sender] -= _amount;

        IERC20Upgradeable(paymentTokenAddress).safeTransfer(
            msg.sender,
            _amount
        );
    }

    /**
     * NFTElection for a certain NFT specified by (_tokenAddress, _tokenId).
     * @dev Called by voters.
     */
    function vote(
        uint256 _electionId,
        uint256 _tokenId,
        uint256 _amount
    ) external notCancelled(_electionId) {
        /******** CHECKS ********/

        address tokenAddress = electionInfo[_electionId].tokenAddress;

        // Check if vote has started
        require(
            block.timestamp >= electionInfo[_electionId].listingTime,
            "NFTElection: the voting process has not started"
        );
        // Check if vote has expired
        require(
            block.timestamp < actualExpirationTime(_electionId, _tokenId),
            "NFTElection: the voting process has been finished"
        );

        // Check if vote amount is enough
        uint256 totalVoted = electionInfo[_electionId].hasVoted[_tokenId][
            msg.sender
        ] + _amount;

        require(
            totalVoted > electionInfo[_electionId].maxVoted[_tokenId],
            "NFTElection: please vote more"
        );

        // Check if the NFT has been transferred to this contract
        require(
            IERC721(tokenAddress).ownerOf(_tokenId) == address(this),
            "NFTElection: nft not owned by contract"
        );

        /******** EFFECTS ********/

        // Burn the tickets
        IPVSTicket(ticketAddress).burn(msg.sender, _amount);

        // Special case: if voter was already the winner
        if (msg.sender == electionInfo[_electionId].winner[_tokenId]) {
            electionInfo[_electionId].hasVoted[_tokenId][
                msg.sender
            ] = totalVoted;
            electionInfo[_electionId].maxVoted[_tokenId] = totalVoted;
        } else {
            uint256 tokenPrice = getPrice(_electionId, _tokenId);

            // Update marginLocked
            marginLocked[msg.sender] += tokenPrice;

            // If margin is not enough
            if (margin[msg.sender] < marginLocked[msg.sender]) {
                IERC20Upgradeable(paymentTokenAddress).safeTransferFrom(
                    msg.sender,
                    address(this),
                    marginLocked[msg.sender] - margin[msg.sender]
                );
                margin[msg.sender] = marginLocked[msg.sender];
            }

            // Voted successfully, update states
            address prevWinner = electionInfo[_electionId].winner[_tokenId];
            electionInfo[_electionId].winner[_tokenId] = msg.sender;
            electionInfo[_electionId].hasVoted[_tokenId][
                msg.sender
            ] = totalVoted;
            electionInfo[_electionId].maxVoted[_tokenId] = totalVoted;

            if (prevWinner != address(0)) {
                marginLocked[prevWinner] -= tokenPrice;
            }

            // Extend the ddl if
            // 0. the current voting person is not the previous winner, and
            // 1. current timestamp is within the `saleEndDuration`, and
            // 2. extendedExpirationTime does not achieve the constraint value
            if (
                block.timestamp + saleEndDuration >=
                actualExpirationTime(_electionId, _tokenId) &&
                electionInfo[_electionId].extendedExpirationTime[_tokenId] <
                saleExtendDurationMax
            ) {
                electionInfo[_electionId].extendedExpirationTime[
                        _tokenId
                    ] += saleExtendDuration;
                emit ExtendExpirationTime(_electionId, tokenAddress, _tokenId);
            }
        }

        if (!electionInfo[_electionId].voted) {
            electionInfo[_electionId].voted = true;
        }

        /******** EVENTS ********/

        emit VoteToken(
            msg.sender,
            _electionId,
            tokenAddress,
            _tokenId,
            _amount
        );
    }

    /**
     * Execute the transaction and send NFT to the winner.
     *
     * @dev Can be called by anyone.
     */
    function claim(uint256[] calldata _electionId, uint256[] calldata _tokenId)
        external
    {
        require(
            _electionId.length == _tokenId.length,
            "NFTElection: invalid input"
        );

        for (uint256 i = 0; i < _electionId.length; i++) {
            require(
                block.timestamp >=
                    actualExpirationTime(_electionId[i], _tokenId[i]),
                "NFTElection: the voting process has not finished"
            );

            uint256 total = getPrice(_electionId[i], _tokenId[i]);
            uint256 fee = total / 2;

            address winnerOfToken = electionInfo[_electionId[i]].winner[
                _tokenId[i]
            ];
            require(
                winnerOfToken != address(0),
                "NFTElection: winner of token is zero address"
            );
            marginLocked[winnerOfToken] -= total;
            margin[winnerOfToken] -= total;

            IERC20Upgradeable(paymentTokenAddress).safeTransfer(
                serviceFeeRecipient,
                fee
            );
            IERC20Upgradeable(paymentTokenAddress).safeTransfer(
                manager[electionInfo[_electionId[i]].tokenAddress],
                total - fee
            );

            IERC721(electionInfo[_electionId[i]].tokenAddress).safeTransferFrom(
                    address(this),
                    winnerOfToken,
                    _tokenId[i]
                );
        }
    }

    /**
     * After the sale has expired, if there is no winner for a specific token,
     * the manager is able to claim back that token.
     */
    function claimBack(uint256 _electionId, uint256[] calldata _tokenId)
        external
        onlyManager(electionInfo[_electionId].tokenAddress)
    {
        for (uint256 i = 0; i < _tokenId.length; i++) {
            require(
                block.timestamp >=
                    actualExpirationTime(_electionId, _tokenId[i]),
                "NFTElection: the voting process has not finished"
            );
            require(
                electionInfo[_electionId].winner[_tokenId[i]] == address(0),
                "NFTElection: the token has a winner"
            );

            IERC721(electionInfo[_electionId].tokenAddress).safeTransferFrom(
                address(this),
                msg.sender,
                _tokenId[i]
            );
        }
    }

    /**
     * Returns the actual expiration time.
     */
    function actualExpirationTime(uint256 _electionId, uint256 _tokenId)
        public
        view
        notCancelled(_electionId)
        returns (uint256)
    {
        return
            electionInfo[_electionId].expirationTime +
            electionInfo[_electionId].extendedExpirationTime[_tokenId];
    }

    function _requireValidTokenIdBounds(
        address _tokenAddress,
        uint256 _tokenIdLowerBound,
        uint256 _tokenIdUpperBound
    ) internal view {
        require(
            _tokenIdLowerBound <= _tokenIdUpperBound,
            "NFTElection: NFTElection: invalid tokenIdBounds in initialization"
        );
        for (uint256 i = 0; i < usedRanges[_tokenAddress].length; i++) {
            require(
                _tokenIdLowerBound > usedRanges[_tokenAddress][i][1] ||
                    _tokenIdUpperBound < usedRanges[_tokenAddress][i][0],
                "NFTElection: invalid tokenIdBounds in initialization"
            );
        }
    }

    function onERC721Received(
        address, /*operator*/
        address, /*from*/
        uint256, /*tokenId*/
        bytes calldata /*data*/
    ) external pure override returns (bytes4) {
        return NFTElection.onERC721Received.selector;
    }
}
