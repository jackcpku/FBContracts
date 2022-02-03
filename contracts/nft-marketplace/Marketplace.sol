// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../nft/management/NFTGateway.sol";

contract Marketplace is Initializable, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20;
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
        address royaltyFeeReceipient;
    }

    uint256 public constant BASE = 10000;
    uint256 public constant BURN = BASE / 2;

    /********************************************************************
     *                        Transaction modes                         *
     ********************************************************************/

    bytes32 public constant ERC721_FOR_ERC20 = keccak256("ERC721_FOR_ERC20");

    /********************************************************************
     *                         State variables                          *
     ********************************************************************/

    // Supported payment ERC20 tokens
    mapping(address => bool) public paymentTokens;
    address mainPaymentToken;

    // Platform address that receives transaction fee
    address public platformAddress;

    /********************************************************************
     *                             Events                               *
     ********************************************************************/

    event MatchTransaction(
        address indexed contractAddress,
        uint256 indexed tokenId,
        address indexed paymentToken,
        uint256 price,
        address seller,
        address buyer
    );

    function initialize() public initializer {
        __Ownable_init();
    }

    /********************************************************************
     *                      Owner-only functions                        *
     ********************************************************************/

    function setPlatformAddress(address _platformAddress) public onlyOwner {
        platformAddress = _platformAddress;
    }

    function setPaymentTokens(address[] calldata _paymentTokens)
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
     *                      New functions                       *
     ********************************************************************/

    mapping(address => mapping(bytes => bool)) cancelledOrFinalized;

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
         * uint256 serviceFee -> platformAddress
         * uint256 royaltyFee -> royaltyFeeReceipient
         * address royaltyFeeReceipient
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
                address royaltyFeeReceipient
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
                royaltyFeeReceipient
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
        if (transactionType == ERC721_FOR_ERC20) {
            /*  CHECKS  */
            require(
                order.marketplaceAddress == address(this),
                "Wrong market address"
            );

            require(
                !cancelledOrFinalized[seller][sellerSig] &&
                    !cancelledOrFinalized[buyer][buyerSig],
                "Signature has been used"
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
            require(
                paymentTokens[order.paymentTokenAddress] == true,
                "Marketplace: invalid payment method"
            );

            // Check signature validity
            require(
                checkSigValidity(seller, order, sellerMetadata, sellerSig),
                "Seller signature is not valid"
            );
            require(
                checkSigValidity(buyer, order, buyerMetadata, buyerSig),
                "Buyer signature is not valid"
            );

            /*  EFFECTS  */
            executeTransfers(order, seller, buyer);

            /*  LOGS  */
            emit MatchTransaction(
                order.targetTokenAddress,
                order.targetTokenId,
                order.paymentTokenAddress,
                order.price,
                seller,
                buyer
            );
        }
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
            cancelledOrFinalized[msg.sender][signature] == false,
            "Signature has been cancelled or used"
        );

        cancelledOrFinalized[msg.sender][signature] = true;
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
     *                Delegated buyer-called functions                  *
     ********************************************************************/

    /********************************************************************
     *                        Helper functions                          *
     ********************************************************************/

    function checkSigValidity(
        address x,
        Order memory order,
        OrderMetadata memory metadata,
        bytes memory sig
    ) internal view returns (bool) {
        if (x == msg.sender) {
            return true;
        }

        bytes32 ethSignedMessageHash = getEthSignedMessageHash(order, metadata);
        if (ECDSA.recover(ethSignedMessageHash, sig) != x) return false;

        return true;
    }

    function getEthSignedMessageHash(
        Order memory order,
        OrderMetadata memory metadata
    ) internal pure returns (bytes32) {
        bytes32 criteriaMessageHash = getMessageHash(order, metadata);
        return ECDSA.toEthSignedMessageHash(criteriaMessageHash);
    }

    /**
     * @dev Calculate sell order digest.
     */
    function getMessageHash(Order memory order, OrderMetadata memory metadata)
        internal
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked(
                    order.marketplaceAddress,
                    order.targetTokenAddress,
                    order.targetTokenId,
                    order.paymentTokenAddress,
                    order.price,
                    order.serviceFee,
                    order.royaltyFee,
                    order.royaltyFeeReceipient,
                    metadata.listingTime,
                    metadata.expirationTime,
                    metadata.maximumFill,
                    metadata.salt
                )
            );
    }

    function executeTransfers(
        Order memory order,
        address seller,
        address buyer
    ) internal {
        // Check balance requirement
        IERC721 nft = IERC721(order.targetTokenAddress);
        require(
            nft.ownerOf(order.targetTokenId) == seller,
            "Marketplace: seller is not owner of this item now"
        );
        IERC20 paymentContract = IERC20(order.paymentTokenAddress);
        require(
            paymentContract.balanceOf(buyer) >= order.price,
            "Marketplace: buyer doesn't have enough token to buy this item"
        );
        require(
            paymentContract.allowance(buyer, address(this)) >= order.price,
            "Marketplace: buyer doesn't approve marketplace to spend payment amount"
        );

        // Transfer ERC721
        nft.safeTransferFrom(seller, buyer, order.targetTokenId);

        // Calculate ERC20 fees
        uint256 fee2platform;
        uint256 fee2burn;
        uint256 fee2cp;
        if (
            order.royaltyFee == 0 &&
            order.serviceFee > BASE / 2 &&
            order.paymentTokenAddress == mainPaymentToken
        ) {
            // Case where manager sells directly
            fee2cp = 0;
            fee2burn = (order.price * order.serviceFee * BURN) / (BASE * BASE);
            fee2platform = (order.price * order.serviceFee) / BASE - fee2burn;
        } else {
            // Case where users sell to each other
            fee2cp = (order.price * order.royaltyFee) / BASE;
            fee2burn = 0;
            fee2platform = (order.price * order.serviceFee) / BASE;
        }

        // Transfer ERC20 to multiple addresses
        if (fee2platform > 0) {
            paymentContract.transferFrom(buyer, platformAddress, fee2platform);
        }
        if (fee2burn > 0) {
            paymentContract.transferFrom(buyer, address(0), fee2burn);
        }
        if (fee2cp > 0) {
            paymentContract.transferFrom(
                buyer,
                order.royaltyFeeReceipient,
                fee2cp
            );
        }
        paymentContract.transferFrom(
            buyer,
            seller,
            order.price - fee2platform - fee2burn - fee2cp
        );
    }
}
