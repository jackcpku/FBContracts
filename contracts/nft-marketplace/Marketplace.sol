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

    // Supported payment ERC20 tokens
    mapping(address => bool) public paymentTokens;

    // Used signatures
    mapping(bytes => bool) public cancelledOrFinalized;

    // When an NFT contract does not associate with the gateway,
    // assign a fallback manager for it to receive transaction fee.
    mapping(address => address) public fallbackManager;

    // Platform address that receives transaction fee
    address public platformAddress;

    // NFT Gateway contract address
    address public nftGateway;

    // When manager sells, fees[0] / 10000 goes to platform
    // When non-manager sells, fees[1] / 10000 goes to platform
    // When non-manager sells, fees[2] / 10000 goes to manager
    uint256[3] private fees;

    // Events
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

        // When manager sells, 5000 / 10000 goes to us
        fees[0] = 5000;
        // When non-manager sells, 100 / 10000 goes to us
        fees[1] = 100;
        // When non-manager sells, another 100 / 10000 goes to game provider (i.e. manager)
        fees[2] = 100;
    }

    /********************************************************************
     *                      Owner-only functions                        *
     ********************************************************************/

    function setNftGateway(address _nftGateway) public onlyOwner {
        nftGateway = _nftGateway;
    }

    /**
     * @dev In case that an NFT contract doesn't associate with the gateway contract,
     * a fallback manager is needed to receive the transaction fee.
     */
    function setFallbackManager(address _nftContract, address _fallbackManager)
        public
        onlyOwner
    {
        fallbackManager[_nftContract] = _fallbackManager;
    }

    function setPlatformAddress(address _platformAddress) public onlyOwner {
        platformAddress = _platformAddress;
    }

    function setFees(uint256[3] memory _fees) public onlyOwner {
        fees[0] = _fees[0];
        fees[1] = _fees[1];
        fees[2] = _fees[2];
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

    /********************************************************************
     *                      User-called functions                       *
     ********************************************************************/

    /**
     * Ignore a single signature.
     * @dev Called when a seller wants to cancel a bid.
     * @param _nftContract Identify the to-be-selled NFT.
     * @param _tokenId Identify the to-be-selled NFT.
     * @param _paymentTokenContract Set the payment token.
     * @param _price Cancel the bid of which price.
     * @param _saltNonce Nonce used for the bid.
     * @param _signature Seller's signature of the whole bid.
     */
    function ignoreSignature(
        address _nftContract,
        uint256 _tokenId,
        address _paymentTokenContract,
        uint256 _price,
        uint256 _saltNonce,
        bytes memory _signature
    ) public {
        bytes32 ethSignedMessageHash = getEthSignedMessageHash(
            _nftContract,
            _tokenId,
            _paymentTokenContract,
            _price,
            _saltNonce
        );
        require(
            ECDSA.recover(ethSignedMessageHash, _signature) == msg.sender,
            "Marketplace: invalid seller signature"
        );

        cancelledOrFinalized[_signature] = true;
    }

    /**
     * Ignore a bunch of signatures. Parameters similar to the single-cancel version.
     * @dev Called when a seller wants to cancel multiple bids.
     * @param _nftContract Identify the to-be-selled NFT.
     * @param _tokenId Identify the to-be-selled NFT.
     * @param _paymentTokenContract Set the payment token.
     * @param _price Cancel the bid of which price.
     * @param _saltNonce Nonce used for the bid.
     * @param _signature Seller's signature of the whole bid.
     */
    function ignoreSignatures(
        address _nftContract,
        uint256 _tokenId,
        address _paymentTokenContract,
        uint256[] memory _price,
        uint256[] memory _saltNonce,
        bytes[] memory _signature
    ) public {
        uint256 len_price = _price.length;
        uint256 len_saltNonce = _saltNonce.length;
        uint256 len_signature = _signature.length;
        require(
            len_price == len_saltNonce && len_price == len_signature,
            "Marketplace: invalid parameters"
        );

        for (uint256 i = 0; i < len_price; i++) {
            ignoreSignature(
                _nftContract,
                _tokenId,
                _paymentTokenContract,
                _price[i],
                _saltNonce[i],
                _signature[i]
            );
        }
    }

    /**
     * @dev Called when buyer matches a sell order.
     * @param _nftContract Identify the to-be-selled NFT.
     * @param _tokenId Identify the to-be-selled NFT.
     * @param _paymentTokenContract Set the payment token.
     * @param _price Cancel the bid of which price.
     * @param _saltNonce Nonce used for the bid.
     * @param _sellerAddress Seller of the to-be-selled NFT.
     * @param _sellerSignature Seller's signature of the whole bid.
     */
    function buy(
        address _nftContract,
        uint256 _tokenId,
        address _paymentTokenContract,
        uint256 _price,
        uint256 _saltNonce,
        address _sellerAddress,
        bytes memory _sellerSignature
    ) external {
        require(
            paymentTokens[_paymentTokenContract] == true,
            "Marketplace: invalid payment method"
        );

        require(
            !cancelledOrFinalized[_sellerSignature],
            "Marketplace: signature used"
        );

        // When sellers place a sell bid, they sign the following items.
        bytes32 ethSignedMessageHash = getEthSignedMessageHash(
            _nftContract,
            _tokenId,
            _paymentTokenContract,
            _price,
            _saltNonce
        );

        require(
            ECDSA.recover(ethSignedMessageHash, _sellerSignature) ==
                _sellerAddress,
            "Marketplace: invalid seller signature"
        );

        matchTransactionUnchecked(
            _nftContract,
            _tokenId,
            _paymentTokenContract,
            _price,
            _sellerAddress,
            msg.sender
        );

        cancelledOrFinalized[_sellerSignature] = true;

        // Emit sale event
        emit MatchTransaction(
            _nftContract,
            _tokenId,
            _paymentTokenContract,
            _price,
            _sellerAddress,
            msg.sender
        );
    }

    /********************************************************************
     *                Delegated buyer-called functions                  *
     ********************************************************************/

    /**
     * @dev Called when buyer wants to match an sell order.
     * @notice Delegator covers the gas fee.
     * @param _nftContract Identify the to-be-selled NFT.
     * @param _tokenId Identify the to-be-selled NFT.
     * @param _paymentTokenContract Set the payment token.
     * @param _price Cancel the bid of which price.
     * @param _saltNonce Nonce used for the bid.
     * @param _sellerAddress Seller of the to-be-selled NFT.
     * @param _sellerSignature Seller's signature of the whole bid.
     * @param _buyerAddress Buyer of the to-be-selled NFT.
     * @param _buyerSignature Buyer's signature of the whole bid.
     *
     */
    function delegatedBuy(
        address _nftContract,
        uint256 _tokenId,
        address _paymentTokenContract,
        uint256 _price,
        uint256 _saltNonce,
        address _sellerAddress,
        bytes memory _sellerSignature,
        address _buyerAddress,
        bytes memory _buyerSignature
    ) external {
        require(
            paymentTokens[_paymentTokenContract] == true,
            "Marketplace: invalid payment method"
        );

        require(
            !cancelledOrFinalized[_sellerSignature] &&
                !cancelledOrFinalized[_buyerSignature],
            "Marketplace: signature used"
        );

        bytes32 ethSignedMessageHash = getEthSignedMessageHash(
            _nftContract,
            _tokenId,
            _paymentTokenContract,
            _price,
            _saltNonce
        );

        // Check seller's signature
        require(
            ECDSA.recover(ethSignedMessageHash, _sellerSignature) ==
                _sellerAddress,
            "Marketplace: invalid seller signature"
        );

        // Check buyer's signature
        require(
            ECDSA.recover(ethSignedMessageHash, _buyerSignature) ==
                _buyerAddress,
            "Marketplace: invalid buyer signature"
        );

        matchTransactionUnchecked(
            _nftContract,
            _tokenId,
            _paymentTokenContract,
            _price,
            _sellerAddress,
            _buyerAddress
        );

        cancelledOrFinalized[_sellerSignature] = true;
        cancelledOrFinalized[_buyerSignature] = true;

        // Emit sale event
        emit MatchTransaction(
            _nftContract,
            _tokenId,
            _paymentTokenContract,
            _price,
            _sellerAddress,
            _buyerAddress
        );
    }

    /********************************************************************
     *                        Helper functions                          *
     ********************************************************************/

    function matchTransactionUnchecked(
        address _nftContract,
        uint256 _tokenId,
        address _paymentTokenContract,
        uint256 _price,
        address _sellerAddress,
        address _buyerAddress
    ) internal {
        // Check current ownership
        IERC721 nft = IERC721(_nftContract);
        require(
            nft.ownerOf(_tokenId) == _sellerAddress,
            "Marketplace: seller is not owner of this item now"
        );

        // Check payment approval and buyer balance
        IERC20 paymentContract = IERC20(_paymentTokenContract);
        require(
            paymentContract.balanceOf(_buyerAddress) >= _price,
            "Marketplace: buyer doesn't have enough token to buy this item"
        );
        require(
            paymentContract.allowance(_buyerAddress, address(this)) >= _price,
            "Marketplace: buyer doesn't approve marketplace to spend payment amount"
        );

        address managerRole = NFTGateway(nftGateway).nftManager(_nftContract);
        bool isExoticContract = (managerRole == address(0));
        if (isExoticContract) {
            require(
                fallbackManager[_nftContract] != address(0),
                "Marketplace: NFT contract manager not found"
            );
            managerRole = fallbackManager[_nftContract];
        }

        // payments[0]: to platform
        // payments[1]: to manager
        // payments[2]: to seller
        uint256[3] memory payments;

        if (
            NFTGateway(nftGateway).isInManagement(
                _sellerAddress,
                _nftContract
            ) || (isExoticContract && _sellerAddress == managerRole)
        ) {
            payments[0] = fees[0].mul(_price).div(10000);
        } else {
            payments[0] = fees[1].mul(_price).div(10000);
            payments[1] = fees[2].mul(_price).div(10000);
        }

        payments[2] = _price.sub(payments[0]).sub(payments[1]);

        // Transfer money to seller
        paymentContract.transferFrom(
            _buyerAddress,
            _sellerAddress,
            payments[2]
        );

        // Transfer fee
        if (payments[0] > 0) {
            paymentContract.transferFrom(
                _buyerAddress,
                platformAddress,
                payments[0]
            );
        }
        if (payments[1] > 0) {
            paymentContract.transferFrom(
                _buyerAddress,
                managerRole,
                payments[1]
            );
        }

        // Transfer item to buyer
        nft.safeTransferFrom(_sellerAddress, _buyerAddress, _tokenId);
    }

    function getEthSignedMessageHash(
        address _nftContract,
        uint256 _tokenId,
        address _paymentTokenContract,
        uint256 _price,
        uint256 _saltNonce
    ) internal pure returns (bytes32) {
        bytes32 criteriaMessageHash = getMessageHash(
            _nftContract,
            _tokenId,
            _paymentTokenContract,
            _price,
            _saltNonce
        );
        return ECDSA.toEthSignedMessageHash(criteriaMessageHash);
    }

    /**
     * @dev Calculate sell order digest.
     */
    function getMessageHash(
        address _nftContract,
        uint256 _tokenId,
        address _paymentTokenContract,
        uint256 _price,
        uint256 _saltNonce
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    _nftContract,
                    _tokenId,
                    _paymentTokenContract,
                    _price,
                    _saltNonce
                )
            );
    }
}
