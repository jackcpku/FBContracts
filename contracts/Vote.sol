// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "./interfaces/IPVSTicket.sol";

contract Vote is Initializable, OwnableUpgradeable {
    using SafeMath for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // The ticket token used for voting
    address public ticketAddress;

    address public serviceFeeRecipient;

    // tokenAddress => (tokenId => (voter => amount))
    mapping(address => mapping(uint256 => mapping(address => uint256)))
        public hasVoted;

    // tokenAddress => (tokenId => maxVoted)
    mapping(address => mapping(uint256 => uint256)) public maxVoted;

    // Vote is valid if block.timestamp in [listingTime, expirationTime)
    // tokenAddress => start time
    mapping(address => uint256) listingTime;
    // tokenAddress => ddl
    mapping(address => uint256) expirationTime;

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
    mapping(address => uint256) marginLocked;

    // Winner of a certain NFT
    mapping(address => mapping(uint256 => address)) winner;

    event ManagerSet(
        address operator,
        address indexed tokenAddress,
        address indexed manager
    );

    event VoteInitialized(
        address manager,
        address indexed tokenAddress,
        uint256 indexed listingTime,
        uint256 indexed expirationTime
    );

    event Voted(
        address indexed voter,
        address indexed tokenAddress,
        uint256 indexed tokenId,
        uint256 amount
    );

    modifier onlyManager(address _tokenAddress) {
        require(msg.sender == manager[_tokenAddress], "Vote: not manager");
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
        emit ManagerSet(msg.sender, _tokenAddress, _manager);
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
    function initializeVote(
        address _tokenAddress,
        uint256 _listingTime,
        uint256 _expirationTime
    ) public onlyManager(_tokenAddress) {
        require(
            listingTime[_tokenAddress] == 0 &&
                expirationTime[_tokenAddress] == 0,
            "Vote: vote can be initialized only once"
        );
        require(
            _listingTime < _expirationTime,
            "Vote: invalid listingTime or expirationTime"
        );
        listingTime[_tokenAddress] = _listingTime;
        expirationTime[_tokenAddress] = _expirationTime;

        emit VoteInitialized(
            msg.sender,
            _tokenAddress,
            _listingTime,
            _expirationTime
        );
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
        require(
            marginLocked[msg.sender] + _amount <= margin[msg.sender],
            "Vote: low margin balance"
        );
        margin[msg.sender] -= _amount;

        IERC20Upgradeable(paymentTokenAddress).safeTransfer(
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
        // Check if vote has started
        require(
            block.timestamp >= listingTime[_tokenAddress],
            "Vote: the voting process has not started"
        );
        // Check if vote has expired
        require(
            block.timestamp < expirationTime[_tokenAddress],
            "Vote: the voting process has been finished"
        );

        // Check if vote amount is enough
        uint256 totalVoted = hasVoted[_tokenAddress][_tokenId][msg.sender] +
            _amount;

        require(
            totalVoted > maxVoted[_tokenAddress][_tokenId],
            "Vote: please vote more"
        );

        // Check if the NFT has been transferred to this contract
        require(
            IERC721(_tokenAddress).ownerOf(_tokenId) == address(this),
            "Vote: nft not owned by contract"
        );

        // Burn the tickets
        IPVSTicket(ticketAddress).burn(msg.sender, _amount);

        // Special case: if voter was already the winner
        if (msg.sender == winner[_tokenAddress][_tokenId]) {
            hasVoted[_tokenAddress][_tokenId][msg.sender] = totalVoted;
            maxVoted[_tokenAddress][_tokenId] = totalVoted;
            return;
        }

        uint256 tokenPrice = getPrice(_tokenAddress, _tokenId);

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
        address prevWinner = winner[_tokenAddress][_tokenId];
        winner[_tokenAddress][_tokenId] = msg.sender;
        hasVoted[_tokenAddress][_tokenId][msg.sender] = totalVoted;
        maxVoted[_tokenAddress][_tokenId] = totalVoted;

        if (prevWinner != address(0)) {
            marginLocked[prevWinner] -= tokenPrice;
        }

        emit Voted(msg.sender, _tokenAddress, _tokenId, _amount);
    }

    /**
     * Execute the transaction and send NFT to the winner.
     *
     * @dev Can be called by anyone.
     */
    function claim(
        address[] calldata _tokenAddress,
        uint256[] calldata _tokenId
    ) external {
        require(_tokenAddress.length == _tokenId.length, "Vote: invalid input");

        for (uint256 i = 0; i < _tokenAddress.length; i++) {
            require(
                block.timestamp >= expirationTime[_tokenAddress[i]],
                "Vote: The voting process has not finished"
            );

            uint256 total = getPrice(_tokenAddress[i], _tokenId[i]);
            uint256 fee = total / 2;

            address winnerOfToken = winner[_tokenAddress[i]][_tokenId[i]];
            marginLocked[winnerOfToken] -= total;
            margin[winnerOfToken] -= total;

            IERC20Upgradeable(paymentTokenAddress).safeTransfer(
                serviceFeeRecipient,
                fee
            );
            IERC20Upgradeable(paymentTokenAddress).safeTransfer(
                manager[_tokenAddress[i]],
                total - fee
            );

            IERC721(_tokenAddress[i]).safeTransferFrom(
                address(this),
                winnerOfToken,
                _tokenId[i]
            );
        }
    }
}
