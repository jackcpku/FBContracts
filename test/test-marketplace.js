const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const { deployNFTGatewayAndNFTFactory } = require("../lib/deploy.js");

describe("Test Marketplace Contract", function () {
  // Contracts
  let gateway, factory, marketplace, fbt;
  let nftContract1; // NFT contract deployed by manager1.
  let nftContract2; // NFT contract deployed by manager2.
  let exoticNftContract; // NFT contract deployed by exoticManager.
  // Addresses
  let owner, gatewayAdmin;
  let platform; // The Big Brother
  let manager1, manager2, exoticManager; // Game providers
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
      exoticManager,
      seller,
      buyer,
      user3,
      randomUser,
    ] = await hre.ethers.getSigners();

    // Deploy FBT contract.
    const FunBoxToken = await hre.ethers.getContractFactory("FunBoxToken");
    fbt = await FunBoxToken.deploy();
    await fbt.deployed();

    // Deploy Gateway and Factory contract.
    ({ gateway, factory } = await deployNFTGatewayAndNFTFactory(gatewayAdmin));

    // Let managers deploy nft contracts.
    let nftContract1Address = await factory
      .connect(manager1)
      .callStatic.deployBasicERC721("nft-contract-1", "UC1");
    await factory.connect(manager1).deployBasicERC721("nft-contract-1", "UC1");
    nftContract1 = await hre.ethers.getContractAt(
      "BasicERC721",
      nftContract1Address
    );

    let nftContract2Address = await factory
      .connect(manager2)
      .callStatic.deployBasicERC721("nft-contract-2", "UC2");
    await factory.connect(manager2).deployBasicERC721("nft-contract-2", "UC2");
    nftContract2 = await hre.ethers.getContractAt(
      "BasicERC721",
      nftContract2Address
    );

    let ExoticNftContract = await hre.ethers.getContractFactory("ExoticNFT");
    exoticNftContract = await ExoticNftContract.connect(exoticManager).deploy(
      "Some NFT",
      "SNFT"
    );
    await exoticNftContract.deployed();

    // Deploy the marketplace contract.
    const Marketplace = await hre.ethers.getContractFactory("Marketplace");
    marketplace = await hre.upgrades.deployProxy(Marketplace, []);
    await marketplace.deployed();

    // Initialize the marketplace contract.
    await marketplace.setMainPaymentToken(fbt.address);
    await marketplace.setServiceFeeRecipient(platform.address);
  });

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
  }) => {
    const transactionType = await marketplace.ERC721_FOR_ERC20();

    // Mints fbt to buyer
    await fbt.transfer(buyer.address, balance);
    // Manager1 mints an NFT to seller.
    await gateway
      .connect(manager1)
      .mint(nftContract1.address, seller.address, "Some URI");
    const tokenIdMinted = await nftContract1.tokenOfOwnerByIndex(
      seller.address,
      0
    );
    expect(tokenIdMinted).to.equal(tokenId);

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
      listingTime: sellerListingTime,
      expirationTime: sellerExpirationTime,
      maximumFill: sellerMaximumFill || 1,
      salt: sellerSalt,
    };
    const sellerMetadataBytes = encoder.encode(
      ["uint256", "uint256", "uint256", "uint256"],
      [
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
      listingTime: 0,
      expirationTime: 0,
      maximumFill: buyerMaximumFill || 1,
      salt: buyerSalt,
    };
    const buyerMetadataBytes = encoder.encode(
      ["uint256", "uint256", "uint256", "uint256"],
      [
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

    await marketplace.atomicMatch_(
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
      .atomicMatch_(
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
      .atomicMatch_(
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

  it("Sell order expired - case 1", async function () {
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
      marketplace.atomicMatch_(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      )
    ).to.be.revertedWith("Sell order expired");
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
      marketplace.atomicMatch_(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      )
    ).to.be.revertedWith("Sell order expired");
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
      marketplace.atomicMatch_(
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

    await marketplace.atomicMatch_(
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
      marketplace.atomicMatch_(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      )
    ).to.be.revertedWith("Order has been filled");
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

    await marketplace.connect(seller).ignoreSignature(sellerSig);

    await expect(
      marketplace.atomicMatch_(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      )
    ).to.be.revertedWith("Signature has been cancelled");
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

    await marketplace.connect(buyer).ignoreSignature(buyerSig);

    await expect(
      marketplace.atomicMatch_(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      )
    ).to.be.revertedWith("Signature has been cancelled");
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

    await marketplace.connect(seller).ignoreSignature(sellerSig);
    await expect(
      marketplace.connect(seller).ignoreSignature(sellerSig)
    ).to.be.revertedWith("Signature has been cancelled or used");
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
      marketplace.atomicMatch_(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        buyerSig, // Wrong seller signature
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      )
    ).to.be.revertedWith("Seller signature is not valid");
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
      marketplace.atomicMatch_(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        sellerSig // Wrong buyer signature
      )
    ).to.be.revertedWith("Buyer signature is not valid");
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
      marketplace.atomicMatch_(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      )
    ).to.be.revertedWith("Invalid maximumFill");
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

    await marketplace.atomicMatch_(
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
