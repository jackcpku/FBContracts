const fs = require("fs");

const hre = require("hardhat");
const { ethers } = require("hardhat");
const {
  deployNFTGatewayAndNFTFactory,
  deployMajorToken,
} = require("../lib/deploy.js");

async function run(tc) {
  // Contracts
  let gateway, factory, marketplace, pvs;
  let basicERC721; // NFT contract deployed by basicERC721Manager.
  // Addresses
  let gatewayAdmin;
  let platform; // The big fee receiver
  let basicERC721Manager; // Game providers
  let seller1, buyer1, seller2, buyer2; // users
  let sellers = {},
    buyers = {};

  async function initialize_environment() {
    // Reset the environment.
    await hre.network.provider.send("hardhat_reset");

    [
      owner,
      gatewayAdmin,
      platform,
      basicERC721Manager,
      seller1,
      buyer1,
      seller2,
      buyer2,
    ] = await hre.ethers.getSigners();

    sellers["seller1"] = seller1;
    buyers["buyer1"] = buyer1;
    sellers["seller2"] = seller2;
    buyers["buyer2"] = buyer2;
    sellers["basicERC721Manager"] = basicERC721Manager;

    // Deploy ERC20 contract.
    pvs = await deployMajorToken(platform.address);
    await pvs.deployed();

    // Deploy Gateway and Factory contract.
    ({ gateway, factory } = await deployNFTGatewayAndNFTFactory(gatewayAdmin));

    // Let managers deploy nft contracts.
    const name = "erc721-contract";
    const symbol = "erc721c";
    const uri = "https://erc721/";
    const salt =
      "0x0000000000000000000000000000000000000000000000000000000000002022";
    let basicERC721Address = await factory
      .connect(basicERC721Manager)
      .callStatic.deployBasicERC721(name, symbol, uri, salt);
    await factory
      .connect(basicERC721Manager)
      .deployBasicERC721(name, symbol, uri, salt);
    basicERC721 = await hre.ethers.getContractAt(
      "BasicERC721",
      basicERC721Address
    );

    // Deploy the marketplace contract.
    const Marketplace = await hre.ethers.getContractFactory("Marketplace");
    marketplace = await hre.upgrades.deployProxy(Marketplace, []);
    await marketplace.deployed();

    // Initialize the marketplace contract.
    await marketplace.setMainPaymentToken(pvs.address);
    await marketplace.setServiceFeeRecipient(platform.address);
  }
  async function getOffers({
    // Order
    tokenId,
    price,
    serviceFee,
    royaltyFee,

    // Seller metadata
    sellerSelector,
    sellerSellOrBuy,
    sellerListingTime,
    sellerExpirationTime,
    sellerMaximumFill,
    sellerSalt,

    // Buyer metadata
    buyerSelector,
    buyerSellOrBuy,
    buyerListingTime,
    buyerExpirationTime,
    buyerMaximumFill,
    buyerSalt,
  }) {
    const seller = sellers[sellerSelector];
    const buyer = buyers[buyerSelector];

    const transactionType = await marketplace.ERC721_FOR_ERC20();
    const encoder = new ethers.utils.AbiCoder();

    // Prepare Order info
    const order = {
      marketplaceAddress: marketplace.address,
      targetTokenAddress: basicERC721.address,
      targetTokenId: tokenId,
      paymentTokenAddress: pvs.address,
      price: price,
      serviceFee: serviceFee,
      royaltyFee: royaltyFee,
      royaltyFeerecipient: basicERC721Manager.address,
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
        sellOrBuy: sellerSellOrBuy,
        listingTime: sellerListingTime,
        expirationTime: sellerExpirationTime,
        maximumFill: sellerMaximumFill,
        salt: sellerSalt,
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
        ancestors: [],
      };
    }

    // ********************************************* BUYER INFO *********************************************

    let buyerOffer;

    {
      // Prepare buyer metadata
      const buyerMetadata = {
        sellOrBuy: buyerSellOrBuy,
        listingTime: buyerListingTime,
        expirationTime: buyerExpirationTime,
        maximumFill: buyerMaximumFill,
        salt: buyerSalt,
      };

      const buyerMetadataBytes = encoder.encode(
        ["bool", "uint256", "uint256", "uint256", "uint256"],
        [
          buyerMetadata.sellOrBuy,
          buyerMetadata.listingTime,
          buyerMetadata.expirationTime,
          buyerMetadata.maximumFill,
          buyerMetadata.salt,
        ]
      );

      // Seller signs
      const buyerMessageHash = ethers.utils.solidityKeccak256(
        ["bytes32", "bytes", "bytes"],
        [transactionType, orderBytes, buyerMetadataBytes]
      );

      const buyerSig = await buyer.signMessage(
        ethers.utils.arrayify(buyerMessageHash)
      );

      buyerOffer = {
        address: buyer.address,
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
          sell_or_buy: buyerMetadata.sellOrBuy,
          listing_time: buyerMetadata.listingTime,
          expiration_time: buyerMetadata.expirationTime,
          maximum_fill: buyerMetadata.maximumFill,
          salt: buyerMetadata.salt,
        },
        message_hash: buyerMessageHash,
        signature: buyerSig,
        token_metadata: {},

        state: "active",
        ancestors: [],
      };
    }

    return {
      sellerOffer,
      buyerOffer,
    };
  }

  await initialize_environment();

  return await getOffers(tc);
}

function generateTestCases(N) {
  const validBundle = [];
  const priceBundle = [];
  const basicTest = {
    tokenId: ethers.utils.hexZeroPad(0, 32),
    price: ethers.utils.hexZeroPad(1000, 16),
    serviceFee: 100,
    royaltyFee: 100,
    sellerSelector: "seller1",
    sellerSellOrBuy: true,
    sellerListingTime: 0,
    sellerExpirationTime: 0,
    sellerMaximumFill: 1,
    sellerSalt:
      "0x0000000000000000000000000000000000000000000000000000000000000011",
    buyerSelector: "buyer1",
    buyerSellOrBuy: false,
    buyerListingTime: 0,
    buyerExpirationTime: 0,
    buyerMaximumFill: 1,
    buyerSalt:
      "0x0000000000000000000000000000000000000000000000000000000000000012",
  };

  // Different price
  for (let i = 0; i < N; i++) {
    const t = JSON.parse(JSON.stringify(basicTest));
    t.tokenId = ethers.utils.hexZeroPad(i + 1, 32);
    t.price = ethers.utils.hexZeroPad((i + 1) * 1000, 16);
    t.sellerSalt =
      basicTest.sellerSalt.substring(0, 20) +
      (i + 1) +
      basicTest.sellerSalt.substring(21);
    t.buyerSalt =
      basicTest.buyerSalt.substring(0, 20) +
      (i + 1) +
      basicTest.buyerSalt.substring(21);
    validBundle.push(t);
  }

  // Different seller
  for (let i = 0; i < N; i++) {
    const t = JSON.parse(JSON.stringify(basicTest));
    t.tokenId = ethers.utils.hexZeroPad(N + i + 1, 32);
    t.price = ethers.utils.hexZeroPad((i + 1) * 1000, 16);
    t.sellerSelector = "seller2";
    t.sellerSalt =
      basicTest.sellerSalt.substring(0, 21) +
      (i + 1) +
      basicTest.sellerSalt.substring(22);
    t.buyerSalt =
      basicTest.buyerSalt.substring(0, 21) +
      (i + 1) +
      basicTest.buyerSalt.substring(22);
    validBundle.push(t);
  }

  // Different buyer
  for (let i = 0; i < N; i++) {
    const t = JSON.parse(JSON.stringify(basicTest));
    t.tokenId = ethers.utils.hexZeroPad(N * 2 + i + 1, 32);
    t.price = ethers.utils.hexZeroPad((i + 1) * 1000, 16);
    t.sellerSalt =
      basicTest.sellerSalt.substring(0, 22) +
      (i + 1) +
      basicTest.sellerSalt.substring(23);
    t.buyerSelector = "buyer2";
    t.buyerSalt =
      basicTest.buyerSalt.substring(0, 22) +
      (i + 1) +
      basicTest.buyerSalt.substring(23);
    validBundle.push(t);
  }

  // Seller is manager
  for (let i = 0; i < N; i++) {
    const t = JSON.parse(JSON.stringify(basicTest));
    t.tokenId = ethers.utils.hexZeroPad(N * 3 + i + 1, 32);
    t.price = ethers.utils.hexZeroPad((i + 1) * 1000, 16);
    t.serviceFee = 5000;
    t.royaltyFee = 0;
    t.sellerSelector = "basicERC721Manager";
    t.sellerSalt =
      basicTest.sellerSalt.substring(0, 23) +
      (i + 1) +
      basicTest.sellerSalt.substring(24);
    t.buyerSalt =
      basicTest.buyerSalt.substring(0, 23) +
      (i + 1) +
      basicTest.buyerSalt.substring(24);
    validBundle.push(t);
  }

  // Same offer, ONLY different price
  for (let i = 0; i < N; i++) {
    const t = JSON.parse(JSON.stringify(basicTest));
    t.price = ethers.utils.hexZeroPad((i + 1) * 10000, 16);
    priceBundle.push(t);
  }

  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }
  fs.writeFileSync(
    `${testDir}/generated-valid-bundle.json`,
    JSON.stringify(validBundle, null, 4)
  );
  fs.writeFileSync(
    `${testDir}/generated-price-bundle.json`,
    JSON.stringify(priceBundle, null, 4)
  );
  console.log("Test cases generated");

  return { validBundle, priceBundle };
}

const testDir = "./test-cases";

async function main() {
  const { validBundle, priceBundle } = generateTestCases(3);
  const validOffers = [],
    priceOffers = [];
  for (let i = 0; i < validBundle.length; i++) {
    console.log(`Processing ${i + 1} / ${validBundle.length}`);
    const tc = validBundle[i];
    const offerPair = await run(tc);
    validOffers.push(offerPair.sellerOffer);
    validOffers.push(offerPair.buyerOffer);
  }
  for (let i = 0; i < priceBundle.length; i++) {
    console.log(`Processing ${i + 1} / ${priceBundle.length}`);
    const tc = priceBundle[i];
    const offerPair = await run(tc);
    priceOffers.push(offerPair.sellerOffer);
    priceOffers.push(offerPair.buyerOffer);
  }
  fs.writeFileSync(
    `${testDir}/generated-valid-offers.json`,
    JSON.stringify(validOffers, null, 4)
  );
  fs.writeFileSync(
    `${testDir}/generated-price-offers.json`,
    JSON.stringify(priceOffers, null, 4)
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
