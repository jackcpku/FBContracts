// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract Marketplace is Initializable, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeMath for uint256;

    /********************************************************************
     *                      Convenience structs                         *
     ********************************************************************/

    struct OrderMetadata {
        bool sellOrBuy; // true for sell, false for buy
        uint256 listingTime;
        uint256 expirationTime;
        uint256 maximumFill;
        uint256 salt;
    }

    struct Order {
        address marketplaceAddress;
        address targetTokenAddress;
        uint256 targetTokenId;
        address paymentTokenAddress;
        uint256 price;
        uint256 serviceFee;
        uint256 royaltyFee;
        address royaltyFeeRecipient;
    }

    /********************************************************************
     *                            Constants                             *
     ********************************************************************/

    // Transaction modes
    bytes32 public constant ERC721_FOR_ERC20 = keccak256("ERC721_FOR_ERC20");
    bytes32 public constant ERC1155_FOR_ERC20 = keccak256("ERC1155_FOR_ERC20");

    // Fee related magic numbers
    uint256 public constant BASE = 10000;
    uint256 public constant BURN = BASE / 2;

    /********************************************************************
     *                         State variables                          *
     ********************************************************************/

    // Supported payment ERC20 tokens
    mapping(address => bool) public paymentTokens;
    address mainPaymentToken;

    // Platform address
    address public serviceFeeRecipient;

    // Store order states
    mapping(address => mapping(bytes32 => bool)) cancelled;
    mapping(address => mapping(bytes32 => uint256)) fills;

    /********************************************************************
     *                             Events                               *
     ********************************************************************/

    event OrderMatched(
        address indexed contractAddress,
        uint256 indexed tokenId,
        address indexed paymentToken,
        uint256 price,
        uint256 fill,
        address seller,
        address buyer,
        bytes32 sellerMessageHash,
        bytes32 buyerMessageHash
    );

    event MessageHashIgnored(
        address indexed operator,
        bytes32 indexed messageHash
    );

    function initialize() public initializer {
        __Ownable_init();
    }

    /********************************************************************
     *                      Owner-only functions                        *
     ********************************************************************/

    function setServiceFeeRecipient(address _serviceFeeRecipient)
        public
        onlyOwner
    {
        serviceFeeRecipient = _serviceFeeRecipient;
    }

    function addPaymentTokens(address[] calldata _paymentTokens)
        public
        onlyOwner
    {
        for (uint256 i = 0; i < _paymentTokens.length; i++) {
            if (paymentTokens[_paymentTokens[i]] == true) {
                continue;
            }

            paymentTokens[_paymentTokens[i]] = true;
        }
    }

    function removePaymentTokens(address[] calldata _removedPaymentTokens)
        public
        onlyOwner
    {
        for (uint256 i = 0; i < _removedPaymentTokens.length; i++) {
            paymentTokens[_removedPaymentTokens[i]] = false;
        }
    }

    function setMainPaymentToken(address _mainPaymentToken) public onlyOwner {
        mainPaymentToken = _mainPaymentToken;
        paymentTokens[_mainPaymentToken] = true;
    }

    /********************************************************************
     *                         Core functions                           *
     ********************************************************************/

    function atomicMatch(
        bytes32 transactionType,
        bytes memory _order,
        address seller,
        bytes memory _sellerMetadata,
        bytes memory sellerSig,
        address buyer,
        bytes memory _buyerMetadata,
        bytes memory buyerSig
    ) public {
        // Check signature validity
        (bool sellerSigValid, bytes32 sellerMessageHash) = checkSigValidity(
            seller,
            transactionType,
            _order,
            _sellerMetadata,
            sellerSig
        );
        require(sellerSigValid, "Seller signature is not valid");

        (bool buyerSigValid, bytes32 buyerMessageHash) = checkSigValidity(
            buyer,
            transactionType,
            _order,
            _buyerMetadata,
            buyerSig
        );
        require(buyerSigValid, "Buyer signature is not valid");

        Order memory order = decodeOrder(_order);
        OrderMetadata memory sellerMetadata = decodeOrderMetadata(
            _sellerMetadata
        );
        OrderMetadata memory buyerMetadata = decodeOrderMetadata(
            _buyerMetadata
        );

        return
            _atomicMatch(
                transactionType,
                order,
                seller,
                sellerMetadata,
                sellerMessageHash,
                buyer,
                buyerMetadata,
                buyerMessageHash
            );
    }

    function _atomicMatch(
        bytes32 transactionType,
        Order memory order,
        address seller,
        OrderMetadata memory sellerMetadata,
        bytes32 sellerMessageHash,
        address buyer,
        OrderMetadata memory buyerMetadata,
        bytes32 buyerMessageHash
    ) internal {
        /*  CHECKS  */
        checkMetaInfo(
            transactionType,
            order,
            seller,
            buyer,
            sellerMetadata,
            buyerMetadata,
            sellerMessageHash,
            buyerMessageHash
        );

        /*  EFFECTS  */
        uint256 fill = Math.min(
            sellerMetadata.maximumFill - fills[seller][sellerMessageHash],
            buyerMetadata.maximumFill - fills[buyer][buyerMessageHash]
        );
        executeTransfers(transactionType, order, fill, seller, buyer);
        fills[seller][sellerMessageHash] += fill;
        fills[buyer][buyerMessageHash] += fill;

        /*  LOGS  */
        emit OrderMatched(
            order.targetTokenAddress,
            order.targetTokenId,
            order.paymentTokenAddress,
            order.price,
            fill,
            seller,
            buyer,
            sellerMessageHash,
            buyerMessageHash
        );
    }

    /********************************************************************
     *                      User-called functions                       *
     ********************************************************************/

    /**
     * Revoke a single order.
     */
    function ignoreMessageHash(bytes32 messageHash) public {
        require(
            cancelled[msg.sender][messageHash] == false,
            "Order has been revoked"
        );

        cancelled[msg.sender][messageHash] = true;

        emit MessageHashIgnored(msg.sender, messageHash);
    }

    /**
     * Revoke a bunch of orders. Parameters similar to the single version.
     */
    function ignoreMessageHashs(bytes32[] memory messageHashs) public {
        for (uint256 i = 0; i < messageHashs.length; i++) {
            ignoreMessageHash(messageHashs[i]);
        }
    }

    /********************************************************************
     *                        Helper functions                          *
     ********************************************************************/

    function checkMetaInfo(
        bytes32 transactionType,
        Order memory order,
        address seller,
        address buyer,
        OrderMetadata memory sellerMetadata,
        OrderMetadata memory buyerMetadata,
        bytes32 sellerMessageHash,
        bytes32 buyerMessageHash
    ) internal view {
        require(
            order.marketplaceAddress == address(this),
            "Wrong market address"
        );
        require(
            paymentTokens[order.paymentTokenAddress] == true,
            "Marketplace: invalid payment method"
        );

        require(sellerMetadata.sellOrBuy == true, "Seller should sell");
        require(buyerMetadata.sellOrBuy == false, "Buyer should buy");

        require(
            !cancelled[seller][sellerMessageHash],
            "Sell order has been revoked"
        );
        require(
            !cancelled[buyer][buyerMessageHash],
            "Buy order has been revoked"
        );
        require(
            fills[seller][sellerMessageHash] < sellerMetadata.maximumFill,
            "Sell order has been filled"
        );
        require(
            fills[buyer][buyerMessageHash] < buyerMetadata.maximumFill,
            "Buy order has been filled"
        );
        require(
            sellerMetadata.listingTime < block.timestamp,
            "Sell order not in effect"
        );
        require(
            sellerMetadata.expirationTime == 0 ||
                sellerMetadata.expirationTime > block.timestamp,
            "Sell order expired"
        );
        require(
            buyerMetadata.listingTime < block.timestamp,
            "Buy order not in effect"
        );
        require(
            buyerMetadata.expirationTime == 0 ||
                buyerMetadata.expirationTime > block.timestamp,
            "Buy order expired"
        );

        // Check mode-specific parameters
        if (transactionType == ERC721_FOR_ERC20) {
            require(
                sellerMetadata.maximumFill == 1 &&
                    sellerMetadata.maximumFill == 1,
                "Invalid maximumFill"
            );
        }
    }

    function checkSigValidity(
        address x,
        bytes32 transactionType,
        bytes memory order,
        bytes memory metadata,
        bytes memory sig
    ) internal view returns (bool valid, bytes32 messageHash) {
        messageHash = getMessageHash(transactionType, order, metadata);
        valid =
            x == msg.sender ||
            x == ECDSA.recover(getEthSignedMessageHash(messageHash), sig);
    }

    function getEthSignedMessageHash(bytes32 criteriaMessageHash)
        internal
        pure
        returns (bytes32)
    {
        return ECDSA.toEthSignedMessageHash(criteriaMessageHash);
    }

    /**
     * @dev Calculate order digest.
     * @notice messageHash is used as index in `cancelled` and `fills`.
     */
    function getMessageHash(
        bytes32 transactionType,
        bytes memory order,
        bytes memory metadata
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(transactionType, order, metadata));
    }

    function executeTransferNFT(
        bytes32 transactionType,
        Order memory order,
        uint256 fill,
        address seller,
        address buyer
    ) internal {
        if (transactionType == ERC721_FOR_ERC20) {
            require(fill == 1, "Invalid fill");
            // Check balance requirement
            IERC721 nft = IERC721(order.targetTokenAddress);

            // Transfer ERC721
            nft.safeTransferFrom(seller, buyer, order.targetTokenId);
        } else if (transactionType == ERC1155_FOR_ERC20) {
            IERC1155MetadataURI nft = IERC1155MetadataURI(
                order.targetTokenAddress
            );

            nft.safeTransferFrom(seller, buyer, order.targetTokenId, fill, "");
        }
    }

    function executeTransferERC20(
        Order memory order,
        uint256 fill,
        address seller,
        address buyer
    ) internal {
        uint256 totalCost = order.price * fill;

        // Check balance requirement
        IERC20Upgradeable paymentContract = IERC20Upgradeable(
            order.paymentTokenAddress
        );
        require(
            paymentContract.balanceOf(buyer) >= totalCost,
            "Marketplace: buyer doesn't have enough token to buy this item"
        );
        require(
            paymentContract.allowance(buyer, address(this)) >= totalCost,
            "Marketplace: buyer doesn't approve marketplace to spend payment amount"
        );

        // Calculate ERC20 fees
        uint256 fee2service;
        uint256 fee2burn;
        uint256 fee2cp;
        if (
            order.royaltyFee == 0 &&
            order.serviceFee > BASE / 10 &&
            order.paymentTokenAddress == mainPaymentToken
        ) {
            // Case where the NFT creator's initial sell
            fee2cp = 0;
            fee2burn = (totalCost * order.serviceFee * BURN) / (BASE * BASE);
            fee2service = (totalCost * order.serviceFee) / BASE - fee2burn;
        } else {
            // Case where users sell to each other
            fee2cp = (totalCost * order.royaltyFee) / BASE;
            fee2burn = 0;
            fee2service = (totalCost * order.serviceFee) / BASE;
        }

        // Transfer ERC20 to multiple addresses
        if (fee2service > 0) {
            paymentContract.safeTransferFrom(
                buyer,
                serviceFeeRecipient,
                fee2service
            );
        }
        if (fee2burn > 0) {
            paymentContract.safeTransferFrom(
                buyer,
                0x000000000000000000000000000000000000dEaD,
                fee2burn
            );
        }
        if (fee2cp > 0) {
            paymentContract.safeTransferFrom(
                buyer,
                order.royaltyFeeRecipient,
                fee2cp
            );
        }
        paymentContract.safeTransferFrom(
            buyer,
            seller,
            totalCost - fee2service - fee2burn - fee2cp
        );
    }

    function executeTransfers(
        bytes32 transactionType,
        Order memory order,
        uint256 fill,
        address seller,
        address buyer
    ) internal {
        executeTransferNFT(transactionType, order, fill, seller, buyer);
        executeTransferERC20(order, fill, seller, buyer);
    }

    function decodeOrder(bytes memory _order)
        internal
        pure
        returns (Order memory)
    {
        (
            address marketplaceAddress,
            address targetTokenAddress,
            uint256 targetTokenId,
            address paymentTokenAddress,
            uint256 price,
            uint256 serviceFee,
            uint256 royaltyFee,
            address royaltyFeeRecipient
        ) = abi.decode(
                _order,
                (
                    address,
                    address,
                    uint256,
                    address,
                    uint256,
                    uint256,
                    uint256,
                    address
                )
            );
        return
            Order(
                marketplaceAddress,
                targetTokenAddress,
                targetTokenId,
                paymentTokenAddress,
                price,
                serviceFee,
                royaltyFee,
                royaltyFeeRecipient
            );
    }

    function decodeOrderMetadata(bytes memory _metadata)
        internal
        pure
        returns (OrderMetadata memory)
    {
        (
            bool sellOrBuy,
            uint256 listingTime,
            uint256 expirationTime,
            uint256 maximumFill,
            uint256 salt
        ) = abi.decode(_metadata, (bool, uint256, uint256, uint256, uint256));
        return
            OrderMetadata(
                sellOrBuy,
                listingTime,
                expirationTime,
                maximumFill,
                salt
            );
    }
}
