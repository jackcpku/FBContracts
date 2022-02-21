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

/**
 * Copied from https://eips.ethereum.org/EIPS/eip-1363
 */
interface IERC1363 is IERC20 {
    function transferAndCall(
        address to,
        uint256 value,
        bytes memory data
    ) external returns (bool);
}

/**
 * Copied from https://eips.ethereum.org/EIPS/eip-1363
 */
interface IERC1363Receiver {
    function onTransferReceived(
        address operator,
        address sender,
        uint256 amount,
        bytes calldata data
    ) external returns (bytes4);
}

contract Vote is Initializable, OwnableUpgradeable, IERC1363Receiver {
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

    // tokenAddress => payment token address
    mapping(address => address) paymentTokenAddress;

    // tokenAddress => price
    mapping(address => uint256) fallbackPrice;

    // tokenAddress => (tokenId => price)
    mapping(address => mapping(uint256 => uint256)) price;

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

    // Called by managers.
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

    function onTransferReceived(
        address, /*operator*/
        address sender,
        uint256 amount,
        bytes calldata data
    ) external override returns (bytes4) {
        require(msg.sender == ticketAddress, "Only ticket should call");

        // decode tokenAddress and tokenId from data
        address tokenAddress = data.toAddress(0);
        uint256 tokenId = data.toUint256(20);

        vote(tokenAddress, tokenId, amount, sender);
        return bytes4(0x88a7ca5c);
    }

    function vote(
        address _tokenAddress,
        uint256 _tokenId,
        uint256 _amount,
        address _voter
    ) internal {
        require(
            block.timestamp <= deadline[_tokenAddress],
            "The voting process is finished"
        );

        uint256 totalVoted = hasVoted[_tokenAddress][_tokenId][_voter] +
            _amount;

        require(
            totalVoted > maxVoted[_tokenAddress][_tokenId],
            "Please vote more"
        );

        IERC20(ticketAddress).safeTransferFrom(_voter, address(this), _amount);

        hasVoted[_tokenAddress][_tokenId][_voter] += _amount;
        maxVoted[_tokenAddress][_tokenId] = totalVoted;
    }

    // Called by winner.
    function claim(address _tokenAddress, uint256 _tokenId) external {
        require(
            block.timestamp > deadline[_tokenAddress],
            "The voting process has not finished"
        );

        require(
            hasVoted[_tokenAddress][_tokenId][msg.sender] ==
                maxVoted[_tokenAddress][_tokenId],
            "Not the winner"
        );

        uint256 singleItemPrice = price[_tokenAddress][_tokenId];
        uint256 total = singleItemPrice;
        if (total == 0) {
            total = fallbackPrice[_tokenAddress];
        }
        uint256 fee = total / 2;

        IERC20(paymentTokenAddress[_tokenAddress]).safeTransferFrom(
            msg.sender,
            serviceFeeRecipient,
            fee
        );
        IERC20(paymentTokenAddress[_tokenAddress]).safeTransferFrom(
            msg.sender,
            manager[_tokenAddress],
            total - fee
        );

        IERC721(_tokenAddress).safeTransferFrom(
            address(this),
            msg.sender,
            _tokenId
        );
    }
}
