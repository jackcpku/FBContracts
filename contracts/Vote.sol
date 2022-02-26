// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC721.sol";

import "solidity-bytes-utils/contracts/BytesLib.sol";

interface Ticket {
    function burn(address owner, uint256 amount) external;
}

contract Vote is Initializable, OwnableUpgradeable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using BytesLib for bytes;

    // The ticket token used for voting
    address public ticketAddress;

    address public serviceFeeRecipient;

    // tokenAddress => (tokenId => (voter => amount))
    mapping(address => mapping(uint256 => mapping(address => uint256)))
        public hasVoted;

    // tokenAddress => (tokenId => maxVoted)
    mapping(address => mapping(uint256 => uint256)) public maxVoted;

    // tokenAddress => ddl
    mapping(address => uint256) deadline;

    // cp of the nft
    mapping(address => address) manager;

    // PVS address
    address paymentTokenAddress;

    // tokenAddress => price
    mapping(address => uint256) fallbackPrice;

    // tokenAddress => (tokenId => price)
    mapping(address => mapping(uint256 => uint256)) price;

    // Total margin of a voter, voter => amount
    mapping(address => uint256) margin;

    // Minimum PVS margin amount
    mapping(address => uint256) marginNeeded;

    // Winner of a certain NFT
    mapping(address => mapping(uint256 => address)) winner;

    // Previous winner of a certain NFT
    mapping(address => mapping(uint256 => address)) prevWinner;

    modifier onlyManager(address _tokenAddress) {
        require(msg.sender == manager[_tokenAddress]);
        _;
    }

    function initialize(address _ticketAddress) public initializer {
        __Ownable_init();
        ticketAddress = _ticketAddress;
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
        manager[_manager] = _tokenAddress;
    }

    // Called by managers.
    // Set the same price for every NFTs of the same tokenAddress.
    function setPrice(address _tokenAddress, uint256 _price)
        public
        onlyManager(_tokenAddress)
    {
        fallbackPrice[_tokenAddress] = _price;
    }

    // Called by managers.
    // Set the price of a single NFT.
    function setPrice(
        address _tokenAddress,
        uint256 _tokenId,
        uint256 _price
    ) public onlyManager(_tokenAddress) {
        price[_tokenAddress][_tokenId] = _price;
    }

    /**
     * @dev Called by managers.
     */
    function initializeVote(address _tokenAddress, uint256 _deadline)
        public
        onlyManager(_tokenAddress)
    {
        require(
            deadline[_tokenAddress] == 0,
            "Vote can be initialized only once"
        );
        deadline[_tokenAddress] = _deadline;
    }

    /**
     * Get the price of a single NFT.
     * @dev If the NFT has a specified price in `price`, return that price,
     * else return the whole collection's fallback price.
     */
    function getPrice(address _tokenAddress, uint256 _tokenId)
        public
        view
        returns (uint256)
    {
        uint256 singleItemPrice = price[_tokenAddress][_tokenId];
        if (singleItemPrice > 0) {
            return singleItemPrice;
        } else {
            return fallbackPrice[_tokenAddress];
        }
    }

    /**
     * When ex-voters didn't want their PVS locked in the margin account,
     * they call this function to withdraw their margin balance.
     *
     * @dev Called by voters.
     */
    function withdrawMargin(uint256 _amount) external {
        require(_amount < margin[msg.sender], "Vote: low margin balance");
        margin[msg.sender] -= _amount;

        IERC20(paymentTokenAddress).safeTransferFrom(
            address(this),
            msg.sender,
            _amount
        );
    }

    /**
     * Vote for a certain NFT specified by (_tokenAddress, _tokenId).
     * @dev Called by voters.
     */
    function vote(
        address _tokenAddress,
        uint256 _tokenId,
        uint256 _amount
    ) external {
        // Check if vote has expired
        require(
            block.timestamp <= deadline[_tokenAddress],
            "The voting process is finished"
        );

        // Check if vote amount is enough
        uint256 totalVoted = hasVoted[_tokenAddress][_tokenId][msg.sender] +
            _amount;

        require(
            totalVoted > maxVoted[_tokenAddress][_tokenId],
            "Please vote more"
        );

        // Burn the tickets
        Ticket(ticketAddress).burn(msg.sender, _amount);

        // Special case: if voter was already the winner
        if (msg.sender == prevWinner[_tokenAddress][_tokenId]) {
            hasVoted[_tokenAddress][_tokenId][msg.sender] = totalVoted;
            maxVoted[_tokenAddress][_tokenId] = totalVoted;
            return;
        }

        // Update marginNeeded
        marginNeeded[msg.sender] += getPrice(_tokenAddress, _tokenId);

        // If margin is not enough
        if (margin[msg.sender] < marginNeeded[msg.sender]) {
            IERC20(paymentTokenAddress).safeTransferFrom(
                msg.sender,
                address(this),
                marginNeeded[msg.sender] - margin[msg.sender]
            );
            margin[msg.sender] = marginNeeded[msg.sender];
        }

        // Voted successfully, update states
        prevWinner[_tokenAddress][_tokenId] = winner[_tokenAddress][_tokenId];
        winner[_tokenAddress][_tokenId] = msg.sender;
        hasVoted[_tokenAddress][_tokenId][msg.sender] = totalVoted;
        maxVoted[_tokenAddress][_tokenId] = totalVoted;

        marginNeeded[prevWinner[_tokenAddress][_tokenId]] -= getPrice(
            _tokenAddress,
            _tokenId
        );
    }

    /**
     * Execute the transaction and send NFT to the winner.
     *
     * @dev Can be called by anyone.
     */
    function claim(address _tokenAddress, uint256 _tokenId) external {
        require(
            block.timestamp > deadline[_tokenAddress],
            "The voting process has not finished"
        );

        address w = winner[_tokenAddress][_tokenId];

        uint256 total = getPrice(_tokenAddress, _tokenId);
        uint256 fee = total / 2;

        marginNeeded[w] -= total;

        IERC20(paymentTokenAddress).safeTransferFrom(
            w,
            serviceFeeRecipient,
            fee
        );
        IERC20(paymentTokenAddress).safeTransferFrom(
            w,
            manager[_tokenAddress],
            total - fee
        );

        IERC721(_tokenAddress).safeTransferFrom(address(this), w, _tokenId);
    }
}
