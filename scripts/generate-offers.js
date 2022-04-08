
const fs = require("fs");

const hre = require("hardhat");
const { ethers } = require("hardhat");

const marketAddr = hre.addrs.marketplace;
const paymentToken = hre.addrs.token;
const royaltyRecipient = "0xE7b9D035919EC67C2a9F91ff7444749fdEaAEC89";
const targetTokenAddr = "0x5E94EC4FE91E34582f5f97177d2Bac72E4D559d7";
const transactionType = "0x22b5a8bed873fdc27b50787a8c5c8cebb4ce4aa6d45cbf801f89520f966863aa"; // ERC721_FOR_ERC20
// "0x0c86c44989a537cca3ca233228ca54ee5604fc7117d8b3da1f71b21b644ce15f"; // ERC1155_FOR_ERC20
const serviceFee = 100;
const royaltyFee = 100;

async function main() {
    const [seller] = await hre.ethers.getSigners();
    const encoder = new ethers.utils.AbiCoder();

    const offers = [];
    for (let i = 0; i < 100; i++) {
        // Prepare Order info
        const order = {
            marketplaceAddress: marketAddr,
            targetTokenAddress: targetTokenAddr,
            targetTokenId: (i + 1).toString(),
            paymentTokenAddress: paymentToken,
            price: ethers.utils.parseUnits((Math.random() * i + 100).toString(), 18).toHexString(),
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
                listingTime: 0,
                expirationTime: 0,
                maximumFill: 1,
                salt: i.toString(),
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
                token_metadata: {},

                state: "active",
            };
        }

        offers.push(sellerOffer);

    }

    fs.writeFileSync(
        `test-cases/seller-offers.json`,
        JSON.stringify(offers, null, 4)
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
