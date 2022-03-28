const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const {
  deployMajorToken,
  deployNFTGatewayAndNFTFactory,
} = require("../lib/deploy.js");

const {
  calculateCreate2AddressBasicERC721,
  calculateCreate2AddressBasicERC1155,
} = require("../lib/create2.js");

describe("Test Marketplace Contract", function () {
  // Contracts
  let gateway, factory, marketplace, fbt;
  let nftContract1; // NFT contract deployed by manager1.
  let nftContract2; // NFT contract deployed by manager2.
  // Addresses
  let owner, gatewayAdmin;
  let platform; // The Big Brother
  let manager1, manager2; // Game providers
  let seller, buyer, user3, randomUser; // users

  const BASE = 10000;

  beforeEach("Initialize environment", async function () {
    // Reset the environment.
    await hre.network.provider.send("hardhat_reset");

    [
      owner,
      gatewayAdmin,
      platform,
      manager1,
      manager2,
      seller,
      buyer,
      user3,
      randomUser,
    ] = await hre.ethers.getSigners();

    // Deploy FBT contract.
    fbt = await deployMajorToken(owner.address);

    // Deploy Gateway and Factory contract.
    ({ gateway, factory } = await deployNFTGatewayAndNFTFactory(gatewayAdmin));

    const from1 = factory.address;
    const deployeeName1 = "BasicERC721";
    const tokenName = "nft-contract-1";
    const tokenSymbol = "UC1";
    const baseURI = "baseURI";
    const salt1 = 233;
    const nftContract1Address = await calculateCreate2AddressBasicERC721(
      from1,
      deployeeName1,
      tokenName,
      tokenSymbol,
      baseURI,
      gateway.address,
      salt1
    );

    await factory
      .connect(manager1)
      .deployBasicERC721(tokenName, tokenSymbol, baseURI, salt1);
    nftContract1 = await hre.ethers.getContractAt(
      deployeeName1,
      nftContract1Address
    );

    const from2 = factory.address;
    const deployeeName2 = "BasicERC1155";
    const uri = "some uri";
    const salt2 = 233;
    const nftContract2Address = await calculateCreate2AddressBasicERC1155(
      from2,
      deployeeName2,
      uri,
      gateway.address,
      salt2
    );

    await factory.connect(manager2).deployBasicERC1155(uri, salt2);
    nftContract2 = await hre.ethers.getContractAt(
      deployeeName2,
      nftContract2Address
    );

    // Deploy the marketplace contract.
    const Marketplace = await hre.ethers.getContractFactory("Marketplace");
    marketplace = await hre.upgrades.deployProxy(Marketplace, []);
    await marketplace.deployed();

    // Initialize the marketplace contract.
    await marketplace.setMainPaymentToken(fbt.address);
    await marketplace.setServiceFeeRecipient(platform.address);
  });

  describe("ERC721 <> ERC20", async () => {
    const getOrderInfo = async ({
      tokenId,
      price,
      balance,
      serviceFee,
      royaltyFee,
      sellerListingTime,
      sellerExpirationTime,
      sellerSalt,
      buyerSalt,
      sellerMaximumFill,
      buyerMaximumFill,
      sellerSellOrBuy,
      buyerSellOrBuy,
    }) => {
      const transactionType = await marketplace.ERC721_FOR_ERC20();

      // Mints fbt to buyer
      await fbt.transfer(buyer.address, balance);
      // Manager1 mints an NFT to seller.
      await gateway
        .connect(manager1)
        .ERC721_mint(nftContract1.address, seller.address, tokenId);

      /**
       * 1. seller puts a sell bid on the market
       * 2. buyer matches that bid, buys directly
       */

      // Get seller's nft tokenId
      const sellerBalance = await nftContract1.balanceOf(seller.address);
      expect(sellerBalance).to.equal(1);

      const encoder = new ethers.utils.AbiCoder();

      // Prepare Order info
      const order = {
        marketplaceAddress: marketplace.address,
        targetTokenAddress: nftContract1.address,
        targetTokenId: tokenId,
        paymentTokenAddress: fbt.address,
        price: price,
        serviceFee: serviceFee,
        royaltyFee: royaltyFee,
        royaltyFeeReceipient: manager1.address,
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
          order.royaltyFeeReceipient,
        ]
      );

      // Prepare seller metadata
      const sellerMetadata = {
        sellOrBuy: sellerSellOrBuy == undefined ? true : sellerSellOrBuy,
        listingTime: sellerListingTime,
        expirationTime: sellerExpirationTime,
        maximumFill: sellerMaximumFill || 1,
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

      // Prepare buyer metadata
      const buyerMetadata = {
        sellOrBuy: buyerSellOrBuy == undefined ? false : buyerSellOrBuy,
        listingTime: 0,
        expirationTime: 0,
        maximumFill: buyerMaximumFill || 1,
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

      // Buyer signs
      const buyerMessageHash = ethers.utils.solidityKeccak256(
        ["bytes32", "bytes", "bytes"],
        [transactionType, orderBytes, buyerMetadataBytes]
      );
      const buyerSig = await buyer.signMessage(
        ethers.utils.arrayify(buyerMessageHash)
      );

      return {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        sellerMessageHash,
        buyerMetadataBytes,
        buyerSig,
        buyerMessageHash,
      };
    };

    it("Basic transactions matching", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000011";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000012";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await nftContract1.connect(seller).approve(marketplace.address, tokenId);
      await fbt.connect(buyer).approve(marketplace.address, price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      /**
       * Checks
       */
      const platFormFee = (price * order.serviceFee) / BASE;
      const managerFee = (price * order.royaltyFee) / BASE;

      expect(await fbt.balanceOf(buyer.address)).to.equal(0);
      expect(await fbt.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await fbt.balanceOf(manager1.address)).to.equal(managerFee);
      expect(await fbt.balanceOf(seller.address)).to.equal(
        price - platFormFee - managerFee
      );
    });

    it("Seller is taker", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000013";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000014";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await nftContract1.connect(seller).approve(marketplace.address, tokenId);
      await fbt.connect(buyer).approve(marketplace.address, price);

      await marketplace
        .connect(seller)
        .atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          "0x",
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        );

      /**
       * Checks
       */
      const platFormFee = (price * order.serviceFee) / BASE;
      const managerFee = (price * order.royaltyFee) / BASE;

      expect(await fbt.balanceOf(buyer.address)).to.equal(0);
      expect(await fbt.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await fbt.balanceOf(manager1.address)).to.equal(managerFee);
      expect(await fbt.balanceOf(seller.address)).to.equal(
        price - platFormFee - managerFee
      );
    });

    it("Buyer is taker", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000015";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000016";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await nftContract1.connect(seller).approve(marketplace.address, tokenId);
      await fbt.connect(buyer).approve(marketplace.address, price);

      await marketplace
        .connect(buyer)
        .atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          "0x"
        );

      /**
       * Checks
       */
      const platFormFee = (price * order.serviceFee) / BASE;
      const managerFee = (price * order.royaltyFee) / BASE;

      expect(await fbt.balanceOf(buyer.address)).to.equal(0);
      expect(await fbt.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await fbt.balanceOf(manager1.address)).to.equal(managerFee);
      expect(await fbt.balanceOf(seller.address)).to.equal(
        price - platFormFee - managerFee
      );
    });

    it("Sell order not started", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 99999999999999;
      const sellerExpirationTime = 0;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000017";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000018";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await nftContract1.connect(seller).approve(marketplace.address, tokenId);
      await fbt.connect(buyer).approve(marketplace.address, price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("Marketplace: sell order not in effect");
    });

    it("Sell order expired - case 2", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 1;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000017";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000018";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await nftContract1.connect(seller).approve(marketplace.address, tokenId);
      await fbt.connect(buyer).approve(marketplace.address, price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("Marketplace: sell order expired");
    });

    it("Buyer balance too low", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 999;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000021";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000022";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await nftContract1.connect(seller).approve(marketplace.address, tokenId);
      await fbt.connect(buyer).approve(marketplace.address, price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith(
        "Marketplace: buyer doesn't have enough token to buy this item"
      );
    });

    it("Already sold", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000023";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000024";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await nftContract1.connect(seller).approve(marketplace.address, tokenId);
      await fbt.connect(buyer).approve(marketplace.address, price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );
      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("Marketplace: sell order has been filled");
    });

    it("Seller cancels order", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000025";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000026";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        sellerMessageHash,
        buyerMetadataBytes,
        buyerSig,
        buyerMessageHash,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await nftContract1.connect(seller).approve(marketplace.address, tokenId);
      await fbt.connect(buyer).approve(marketplace.address, price);

      await marketplace.connect(seller).ignoreMessageHash(sellerMessageHash);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("Marketplace: sell order has been revoked");
    });

    it("Buyer cancels order", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000027";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000028";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        sellerMessageHash,
        buyerMetadataBytes,
        buyerSig,
        buyerMessageHash,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await nftContract1.connect(seller).approve(marketplace.address, tokenId);
      await fbt.connect(buyer).approve(marketplace.address, price);

      await marketplace.connect(buyer).ignoreMessageHash(buyerMessageHash);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("Marketplace: buy order has been revoked");
    });

    it("Seller cancels twice", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000051";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000052";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        sellerMessageHash,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await nftContract1.connect(seller).approve(marketplace.address, tokenId);
      await fbt.connect(buyer).approve(marketplace.address, price);

      await marketplace.connect(seller).ignoreMessageHash(sellerMessageHash);
      await expect(
        marketplace.connect(seller).ignoreMessageHash(sellerMessageHash)
      ).to.be.revertedWith("Marketplace: order has been revoked");
    });

    it("Invalid seller signature", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000031";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000032";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await nftContract1.connect(seller).approve(marketplace.address, tokenId);
      await fbt.connect(buyer).approve(marketplace.address, price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          buyerSig, // Wrong seller signature
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("Marketplace: invalid seller signature");
    });

    it("Invalid buyer signature", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000033";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000034";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await nftContract1.connect(seller).approve(marketplace.address, tokenId);
      await fbt.connect(buyer).approve(marketplace.address, price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          sellerSig // Wrong buyer signature
        )
      ).to.be.revertedWith("Marketplace: invalid buyer signature");
    });

    it("Invalid fill", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000061";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000062";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
        buyerMaximumFill: 1,
        sellerMaximumFill: 2,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await nftContract1.connect(seller).approve(marketplace.address, tokenId);
      await fbt.connect(buyer).approve(marketplace.address, price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("Marketplace: invalid maximumFill");
    });

    it("Seller buys", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000091";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000092";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
        sellerSellOrBuy: false,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await nftContract1.connect(seller).approve(marketplace.address, tokenId);
      await fbt.connect(buyer).approve(marketplace.address, price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("Marketplace: seller should sell");
    });

    it("Buyer sells", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000091";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000092";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
        buyerSellOrBuy: true,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await nftContract1.connect(seller).approve(marketplace.address, tokenId);
      await fbt.connect(buyer).approve(marketplace.address, price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("Marketplace: buyer should buy");
    });

    it("Manager <> user transaction", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 5000;
      const royaltyFee = 0;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000035";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000036";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await nftContract1.connect(seller).approve(marketplace.address, tokenId);
      await fbt.connect(buyer).approve(marketplace.address, price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      /**
       * Checks
       */
      const burnFee = (price * order.serviceFee) / BASE / 2;
      const platFormFee = (price * order.serviceFee) / BASE - burnFee;
      const managerFee = 0;

      expect(await fbt.balanceOf(buyer.address)).to.equal(0);
      expect(
        await fbt.balanceOf("0x000000000000000000000000000000000000dEaD")
      ).to.equal(burnFee);
      expect(await fbt.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await fbt.balanceOf(manager1.address)).to.equal(0);
      expect(await fbt.balanceOf(seller.address)).to.equal(
        price - burnFee - platFormFee - managerFee
      );
    });
  });

  describe("ERC1155 <> ERC20", async () => {
    const getOrderInfo = async ({
      tokenId,
      price,
      balance,
      serviceFee,
      royaltyFee,
      sellerMaximumFill,
      sellerSalt,
      buyerMaximumFill,
      buyerSalt,
      sellerListingTime,
      sellerExpirationTime,
      sellerSellOrBuy,
      buyerSellOrBuy,
    }) => {
      const transactionType = await marketplace.ERC1155_FOR_ERC20();

      // Mints fbt to buyer
      await fbt.transfer(buyer.address, balance);
      // Manager of some erc1155 mints some NFT to seller.
      await gateway
        .connect(manager2)
        .ERC1155_mint(
          nftContract2.address,
          seller.address,
          tokenId,
          sellerMaximumFill,
          "0x"
        );

      /**
       * 1. seller puts a sell bid on the market
       * 2. buyer matches that bid, buys directly
       */

      const encoder = new ethers.utils.AbiCoder();

      // Prepare Order info
      const order = {
        marketplaceAddress: marketplace.address,
        targetTokenAddress: nftContract2.address,
        targetTokenId: tokenId,
        paymentTokenAddress: fbt.address,
        price: price,
        serviceFee: serviceFee,
        royaltyFee: royaltyFee,
        royaltyFeeReceipient: manager2.address,
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
          order.royaltyFeeReceipient,
        ]
      );

      // Prepare seller metadata
      const sellerMetadata = {
        sellOrBuy: sellerSellOrBuy == undefined ? true : sellerSellOrBuy,
        listingTime: sellerListingTime || 0,
        expirationTime: sellerExpirationTime || 0,
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

      // Prepare buyer metadata
      const buyerMetadata = {
        sellOrBuy: buyerSellOrBuy == undefined ? false : buyerSellOrBuy,
        listingTime: 0,
        expirationTime: 0,
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

      // Buyer signs
      const buyerMessageHash = ethers.utils.solidityKeccak256(
        ["bytes32", "bytes", "bytes"],
        [transactionType, orderBytes, buyerMetadataBytes]
      );
      const buyerSig = await buyer.signMessage(
        ethers.utils.arrayify(buyerMessageHash)
      );

      return {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      };
    };

    it("Basic transactions matching", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 10000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerMaximumFill = 10;
      const buyerMaximumFill = 10;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000011";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000012";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerMaximumFill,
        buyerMaximumFill,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending all.
       * 2. Buyer approves the marketplace contract of spending buyerMaxmumFill amount.
       */
      await nftContract2
        .connect(seller)
        .setApprovalForAll(marketplace.address, true);
      await fbt
        .connect(buyer)
        .approve(marketplace.address, buyerMaximumFill * price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      /**
       * Checks
       */
      const totalCost = Math.min(sellerMaximumFill, buyerMaximumFill) * price;
      const platFormFee = (totalCost * order.serviceFee) / BASE;
      const managerFee = (totalCost * order.royaltyFee) / BASE;

      expect(await fbt.balanceOf(buyer.address)).to.equal(balance - totalCost);
      expect(await fbt.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await fbt.balanceOf(manager2.address)).to.equal(managerFee);
      expect(await fbt.balanceOf(seller.address)).to.equal(
        totalCost - platFormFee - managerFee
      );
    });

    it("Seller sells more", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 10000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerMaximumFill = 20;
      const buyerMaximumFill = 10;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000013";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000014";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerMaximumFill,
        buyerMaximumFill,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending all.
       * 2. Buyer approves the marketplace contract of spending buyerMaxmumFill amount.
       */
      await nftContract2
        .connect(seller)
        .setApprovalForAll(marketplace.address, true);
      await fbt
        .connect(buyer)
        .approve(marketplace.address, buyerMaximumFill * price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      /**
       * Checks
       */
      const totalCost = Math.min(sellerMaximumFill, buyerMaximumFill) * price;
      const platFormFee = (totalCost * order.serviceFee) / BASE;
      const managerFee = (totalCost * order.royaltyFee) / BASE;

      expect(await fbt.balanceOf(buyer.address)).to.equal(0);
      expect(await fbt.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await fbt.balanceOf(manager2.address)).to.equal(managerFee);
      expect(await fbt.balanceOf(seller.address)).to.equal(
        totalCost - platFormFee - managerFee
      );
    });

    it("Buyer buys more", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 20000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerMaximumFill = 10;
      const buyerMaximumFill = 20;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000015";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000016";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerMaximumFill,
        buyerMaximumFill,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending all.
       * 2. Buyer approves the marketplace contract of spending buyerMaxmumFill amount.
       */
      await nftContract2
        .connect(seller)
        .setApprovalForAll(marketplace.address, true);
      await fbt
        .connect(buyer)
        .approve(marketplace.address, buyerMaximumFill * price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      /**
       * Checks
       */
      const totalCost = Math.min(sellerMaximumFill, buyerMaximumFill) * price;
      const platFormFee = (totalCost * order.serviceFee) / BASE;
      const managerFee = (totalCost * order.royaltyFee) / BASE;

      expect(await fbt.balanceOf(buyer.address)).to.equal(balance - totalCost);
      expect(await fbt.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await fbt.balanceOf(manager2.address)).to.equal(managerFee);
      expect(await fbt.balanceOf(seller.address)).to.equal(
        totalCost - platFormFee - managerFee
      );
    });

    it("Buy twice using same signature", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 10000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerMaximumFill = 10;
      const buyerMaximumFill = 5;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000017";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000018";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerMaximumFill,
        buyerMaximumFill,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending all.
       * 2. Buyer approves the marketplace contract of spending buyerMaxmumFill amount.
       */
      await nftContract2
        .connect(seller)
        .setApprovalForAll(marketplace.address, true);
      await fbt
        .connect(buyer)
        .approve(marketplace.address, buyerMaximumFill * price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      await fbt
        .connect(buyer)
        .approve(marketplace.address, buyerMaximumFill * price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("Marketplace: buy order has been filled");
    });

    it("Buy twice using different signature", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 10000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerMaximumFill = 10;
      const buyerMaximumFill = 5;
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000021";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000022";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerMaximumFill,
        buyerMaximumFill,
        sellerSalt,
        buyerSalt,
      });

      await nftContract2
        .connect(seller)
        .setApprovalForAll(marketplace.address, true);
      await fbt
        .connect(buyer)
        .approve(marketplace.address, buyerMaximumFill * price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      // The second buy

      const buyerSalt2 =
        "0x0000000000000000000000000000000000000000000000000000000000000023";

      const {
        transactionType2,
        order2,
        orderBytes2,
        sellerMetadataBytes2,
        sellerSig2,
        buyerMetadataBytes: buyerMetadataBytes2,
        buyerSig: buyerSig2,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerMaximumFill,
        buyerMaximumFill,
        sellerSalt,
        buyerSalt: buyerSalt2,
      });

      await fbt
        .connect(buyer)
        .approve(marketplace.address, buyerMaximumFill * price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes2,
        buyerSig2
      );

      /**
       * Checks
       */
      const totalCost =
        Math.min(sellerMaximumFill, 2 * buyerMaximumFill) * price;
      const platFormFee = (totalCost * order.serviceFee) / BASE;
      const managerFee = (totalCost * order.royaltyFee) / BASE;

      expect(await fbt.balanceOf(buyer.address)).to.equal(
        balance * 2 - totalCost
      );
      expect(await fbt.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await fbt.balanceOf(manager2.address)).to.equal(managerFee);
      expect(await fbt.balanceOf(seller.address)).to.equal(
        totalCost - platFormFee - managerFee
      );
    });

    it("Buy twice exceeding selling amount", async function () {
      const tokenId = 0;
      const price = 1000;
      const balance = 12000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerMaximumFill = 10;
      const buyerMaximumFill = 6; // 6 + 6 > 10
      const sellerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000031";
      const buyerSalt =
        "0x0000000000000000000000000000000000000000000000000000000000000032";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerMaximumFill,
        buyerMaximumFill,
        sellerSalt,
        buyerSalt,
      });

      await nftContract2
        .connect(seller)
        .setApprovalForAll(marketplace.address, true);
      await fbt
        .connect(buyer)
        .approve(marketplace.address, buyerMaximumFill * price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      // The second buy

      const buyerSalt2 =
        "0x0000000000000000000000000000000000000000000000000000000000001234";

      const {
        transactionType2,
        order2,
        orderBytes2,
        sellerMetadataBytes2,
        sellerSig2,
        buyerMetadataBytes: buyerMetadataBytes2,
        buyerSig: buyerSig2,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerMaximumFill,
        buyerMaximumFill,
        sellerSalt,
        buyerSalt: buyerSalt2,
      });

      await fbt
        .connect(buyer)
        .approve(marketplace.address, buyerMaximumFill * price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes2,
        buyerSig2
      );

      /**
       * Checks
       */
      const totalCost =
        Math.min(sellerMaximumFill, 2 * buyerMaximumFill) * price;
      const platFormFee = (totalCost * order.serviceFee) / BASE;
      const managerFee = (totalCost * order.royaltyFee) / BASE;

      expect(await fbt.balanceOf(buyer.address)).to.equal(
        balance * 2 - totalCost
      );
      expect(await fbt.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await fbt.balanceOf(manager2.address)).to.equal(managerFee);
      expect(await fbt.balanceOf(seller.address)).to.equal(
        totalCost - platFormFee - managerFee
      );
    });
  });
});
