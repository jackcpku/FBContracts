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

    uint256 public constant BASE = 10000;
    uint256 public constant BURN = BASE / 2;

    /********************************************************************
     *                        Transaction modes                         *
     ********************************************************************/

    bytes32 public constant ERC721_FOR_ERC20 = keccak256("ERC721_FOR_ERC20");
    bytes32 public constant ERC1155_FOR_ERC20 = keccak256("ERC1155_FOR_ERC20");

    /********************************************************************
     *                         State variables                          *
     ********************************************************************/

    // Supported payment ERC20 tokens
    mapping(address => bool) public paymentTokens;
    address mainPaymentToken;

    // Platform address
    address public serviceFeeRecipient;

    /********************************************************************
     *                             Events                               *
     ********************************************************************/

    event MatchTransaction(
        address indexed contractAddress,
        uint256 indexed tokenId,
        address indexed paymentToken,
        uint256 price,
        uint256 fill,
        address seller,
        address buyer
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

    mapping(address => mapping(bytes => bool)) cancelled;
    mapping(address => mapping(bytes => uint256)) fills;

    function atomicMatch_(
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
        require(
            checkSigValidity(
                seller,
                transactionType,
                _order,
                _sellerMetadata,
                sellerSig
            ),
            "Seller signature is not valid"
        );
        require(
            checkSigValidity(
                buyer,
                transactionType,
                _order,
                _buyerMetadata,
                buyerSig
            ),
            "Buyer signature is not valid"
        );

        /*
         * `sellerData` detail
         * uint256 listingTime
         * uint256 expirationTime
         * uint256 maximumFill
         * uint256 salt
         *
         * `buyerData` detail
         * uint256 listingTime
         * uint256 expirationTime
         * uint256 maximumFill
         * uint256 salt
         *
         * `order` detail
         * address marketplaceAddress
         * address targetTokenAddress
         * uint256 targetTokenId
         * address paymentTokenAddress
         * uint256 price
         * uint256 serviceFee -> serviceFeeRecipient
         * uint256 royaltyFee -> royaltyFeeRecipient
         * address royaltyFeeRecipient
         */
        Order memory order;
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
            order = Order(
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
        OrderMetadata memory sellerMetadata;
        {
            (
                uint256 listingTime,
                uint256 expirationTime,
                uint256 maximumFill,
                uint256 salt
            ) = abi.decode(
                    _sellerMetadata,
                    (uint256, uint256, uint256, uint256)
                );
            sellerMetadata = OrderMetadata(
                listingTime,
                expirationTime,
                maximumFill,
                salt
            );
        }
        OrderMetadata memory buyerMetadata;
        {
            (
                uint256 listingTime,
                uint256 expirationTime,
                uint256 maximumFill,
                uint256 salt
            ) = abi.decode(
                    _buyerMetadata,
                    (uint256, uint256, uint256, uint256)
                );
            buyerMetadata = OrderMetadata(
                listingTime,
                expirationTime,
                maximumFill,
                salt
            );
        }
        return
            atomicMatch(
                transactionType,
                order,
                seller,
                sellerMetadata,
                sellerSig,
                buyer,
                buyerMetadata,
                buyerSig
            );
    }

    function atomicMatch(
        bytes32 transactionType,
        Order memory order,
        address seller,
        OrderMetadata memory sellerMetadata,
        bytes memory sellerSig,
        address buyer,
        OrderMetadata memory buyerMetadata,
        bytes memory buyerSig
    ) internal {
        /*  CHECKS  */
        checkMetaInfo(
            transactionType,
            order,
            seller,
            buyer,
            sellerMetadata,
            buyerMetadata,
            sellerSig,
            buyerSig
        );

        /*  EFFECTS  */
        uint256 fill = Math.min(
            sellerMetadata.maximumFill - fills[seller][sellerSig],
            buyerMetadata.maximumFill - fills[buyer][buyerSig]
        );
        executeTransfers(transactionType, order, fill, seller, buyer);
        fills[seller][sellerSig] += fill;
        fills[buyer][buyerSig] += fill;

        /*  LOGS  */
        emit MatchTransaction(
            order.targetTokenAddress,
            order.targetTokenId,
            order.paymentTokenAddress,
            order.price,
            fill,
            seller,
            buyer
        );
    }

    /********************************************************************
     *                      User-called functions                       *
     ********************************************************************/

    /**
     * Ignore a single signature.
     * @param signature Bidder's signature of the order.
     */
    function ignoreSignature(bytes memory signature) public {
        require(
            cancelled[msg.sender][signature] == false,
            "Signature has been cancelled or used"
        );

        cancelled[msg.sender][signature] = true;
    }

    /**
     * Ignore a bunch of signatures. Parameters similar to the single-cancel version.
     */
    function ignoreSignatures(bytes[] memory signatures) public {
        for (uint256 i = 0; i < signatures.length; i++) {
            ignoreSignature(signatures[i]);
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
        bytes memory sellerSig,
        bytes memory buyerSig
    ) internal view {
        require(
            order.marketplaceAddress == address(this),
            "Wrong market address"
        );
        require(
            paymentTokens[order.paymentTokenAddress] == true,
            "Marketplace: invalid payment method"
        );

        require(
            !cancelled[seller][sellerSig] && !cancelled[buyer][buyerSig],
            "Signature has been cancelled"
        );
        require(
            fills[seller][sellerSig] < sellerMetadata.maximumFill &&
                fills[buyer][buyerSig] < buyerMetadata.maximumFill,
            "Order has been filled"
        );
        require(
            sellerMetadata.listingTime < block.timestamp &&
                (sellerMetadata.expirationTime == 0 ||
                    sellerMetadata.expirationTime > block.timestamp),
            "Sell order expired"
        );
        require(
            buyerMetadata.listingTime < block.timestamp &&
                (buyerMetadata.expirationTime == 0 ||
                    buyerMetadata.expirationTime > block.timestamp),
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
    ) internal view returns (bool) {
        if (x == msg.sender) {
            return true;
        }

        bytes32 ethSignedMessageHash = getEthSignedMessageHash(
            transactionType,
            order,
            metadata
        );
        if (ECDSA.recover(ethSignedMessageHash, sig) != x) return false;

        return true;
    }

    function getEthSignedMessageHash(
        bytes32 transactionType,
        bytes memory order,
        bytes memory metadata
    ) internal pure returns (bytes32) {
        bytes32 criteriaMessageHash = getMessageHash(
            transactionType,
            order,
            metadata
        );
        return ECDSA.toEthSignedMessageHash(criteriaMessageHash);
    }

    /**
     * @dev Calculate sell order digest.
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
        uint256 totalPrice = order.price * fill;

        // Check balance requirement
        IERC20Upgradeable paymentContract = IERC20Upgradeable(
            order.paymentTokenAddress
        );
        require(
            paymentContract.balanceOf(buyer) >= totalPrice,
            "Marketplace: buyer doesn't have enough token to buy this item"
        );
        require(
            paymentContract.allowance(buyer, address(this)) >= totalPrice,
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
            fee2burn = (totalPrice * order.serviceFee * BURN) / (BASE * BASE);
            fee2service = (totalPrice * order.serviceFee) / BASE - fee2burn;
        } else {
            // Case where users sell to each other
            fee2cp = (totalPrice * order.royaltyFee) / BASE;
            fee2burn = 0;
            fee2service = (totalPrice * order.serviceFee) / BASE;
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
            totalPrice - fee2service - fee2burn - fee2cp
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
}
