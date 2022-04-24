const fs = require("fs");
const hre = require("hardhat");
const { ethers } = require("hardhat");

// Check this params !!
const royaltyRecipient = "0xE7b9D035919EC67C2a9F91ff7444749fdEaAEC89";
const targetTokenAddr = "0xFE9d0b6faF0e2b3CE23D62b9bE0E471C533584a2";
const targetTokenId = 1;
const termNo = 1;
const price = 100;
const amount = 10;
const listingTime = Date.UTC(2022, 4 - 1, 22, 00, 00, 00) / 1000

const marketAddr = hre.addrs.marketplace;
const paymentToken = hre.addrs.token;
// const transactionType = "0x22b5a8bed873fdc27b50787a8c5c8cebb4ce4aa6d45cbf801f89520f966863aa"; // ERC721_FOR_ERC20
const transactionType = "0x0c86c44989a537cca3ca233228ca54ee5604fc7117d8b3da1f71b21b644ce15f"; // ERC1155_FOR_ERC20

const serviceFee = 0;
const royaltyFee = 0;

async function main() {
    const [seller] = await hre.ethers.getSigners();
    const encoder = new ethers.utils.AbiCoder();

    // Prepare Order info
    const order = {
        marketplaceAddress: marketAddr,
        targetTokenAddress: targetTokenAddr,
        targetTokenId: targetTokenId.toString(),
        paymentTokenAddress: paymentToken,
        price: ethers.utils.parseUnits(price.toString(), 18).toHexString(),
        serviceFee: serviceFee,
        royaltyFee: royaltyFee,
        royaltyFeerecipient: royaltyRecipient,
    };

    const orderBytes = encoder.encode(
        [
            "address",
            "address",
            "uint256",
            "address",
            "uint256",
            "uint256",
            "uint256",
            "address",
        ],
        [
            order.marketplaceAddress,
            order.targetTokenAddress,
            order.targetTokenId,
            order.paymentTokenAddress,
            order.price,
            order.serviceFee,
            order.royaltyFee,
            order.royaltyFeerecipient,
        ]
    );

    // ********************************************* SELLER INFO *********************************************

    let sellerOffer;

    {
        // Prepare seller metadata
        const sellerMetadata = {
            sellOrBuy: true,
            listingTime: listingTime,
            expirationTime: 0,
            maximumFill: amount,
            salt: termNo.toString(),
        };
        const sellerMetadataBytes = encoder.encode(
            ["bool", "uint256", "uint256", "uint256", "uint256"],
            [
                sellerMetadata.sellOrBuy,
                sellerMetadata.listingTime,
                sellerMetadata.expirationTime,
                sellerMetadata.maximumFill,
                sellerMetadata.salt,
            ]
        );

        // Seller signs
        const sellerMessageHash = ethers.utils.solidityKeccak256(
            ["bytes32", "bytes", "bytes"],
            [transactionType, orderBytes, sellerMetadataBytes]
        );

        const sellerSig = await seller.signMessage(
            ethers.utils.arrayify(sellerMessageHash)
        );

        sellerOffer = {
            address: seller.address,
            transaction_type: transactionType,
            order: {
                marketplace_address: order.marketplaceAddress,
                target_token_address: order.targetTokenAddress,
                target_token_id: order.targetTokenId,
                payment_token_address: order.paymentTokenAddress,
                price: order.price,
                service_fee: order.serviceFee,
                royalty_fee: order.royaltyFee,
                royalty_fee_recipient: order.royaltyFeerecipient,
            },
            order_metadata: {
                sell_or_buy: sellerMetadata.sellOrBuy,
                listing_time: sellerMetadata.listingTime,
                expiration_time: sellerMetadata.expirationTime,
                maximum_fill: sellerMetadata.maximumFill,
                salt: sellerMetadata.salt,
            },
            message_hash: sellerMessageHash,
            signature: sellerSig,

            state: "active",
        };
    }

    fs.writeFileSync(
        `test-cases/blindbox-offer.json`,
        JSON.stringify(sellerOffer, null, 4)
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
