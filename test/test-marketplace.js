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
  let seller, buyer, user3, randomUser; // Riders

  let originalBalance;
  let fees;

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

    // Send fbt to users.
    originalBalance = 1000000;
    await fbt.transfer(seller.address, originalBalance);
    await fbt.transfer(buyer.address, originalBalance);

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
    await marketplace.setPlatformAddress(platform.address);

    // Manager1 mints an NFT to seller.
    await gateway
      .connect(manager1)
      .mint(nftContract1.address, seller.address, "Some URI");
  });

  it("Basic transactions matching", async function () {
    /**
     * 1. seller puts a sell bid on the market
     * 2. buyer matches that bid, buys directly
     */

    // Get seller's nft tokenId
    const sellerBalance = await nftContract1.balanceOf(seller.address);
    expect(sellerBalance).to.equal(1);
    const tokenId = await nftContract1.tokenOfOwnerByIndex(seller.address, 0);

    console.log({ tokenId });

    const price = 1000;

    const encoder = new ethers.utils.AbiCoder();

    // Prepare Order info
    const order = {
      marketplaceAddress: marketplace.address,
      targetTokenAddress: nftContract1.address,
      targetTokenId: tokenId,
      paymentTokenAddress: fbt.address,
      price: price,
      serviceFee: 100,
      royaltyFee: 100,
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
      listingTime: 0,
      expirationTime: 0,
      maximumFill: 1,
      salt: "0x0000000000000000000000000000000000000000000000000000000000000011",
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
      [
        "address",
        "address",
        "uint256",
        "address",
        "uint256",
        "uint256",
        "uint256",
        "address",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
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
        sellerMetadata.listingTime,
        sellerMetadata.expirationTime,
        sellerMetadata.maximumFill,
        sellerMetadata.salt,
      ]
    );
    const sellerSig = await seller.signMessage(
      ethers.utils.arrayify(sellerMessageHash)
    );

    // Prepare buyer metadata
    const buyerMetadata = {
      listingTime: 0,
      expirationTime: 0,
      maximumFill: 1,
      salt: "0x0000000000000000000000000000000000000000000000000000000000000012",
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
      [
        "address",
        "address",
        "uint256",
        "address",
        "uint256",
        "uint256",
        "uint256",
        "address",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
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
        buyerMetadata.listingTime,
        buyerMetadata.expirationTime,
        buyerMetadata.maximumFill,
        buyerMetadata.salt,
      ]
    );
    const buyerSig = await buyer.signMessage(
      ethers.utils.arrayify(buyerMessageHash)
    );

    /**
     * Transaction preparations.
     * 1. Seller approves the marketplace contract of spending `tokenId`.
     * 2. Buyer approves the marketplace contract of spending `price` amount.
     */
    await nftContract1.connect(seller).approve(marketplace.address, tokenId);
    await fbt.connect(buyer).approve(marketplace.address, price);

    await marketplace.atomicMatch_(
      await marketplace.ERC721_FOR_ERC20(),
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
    const platFormFee = (price * order.serviceFee) / 10000;
    const managerFee = (price * order.royaltyFee) / 10000;

    expect(await fbt.balanceOf(buyer.address)).to.equal(
      originalBalance - price
    );
    expect(await fbt.balanceOf(platform.address)).to.equal(platFormFee);
    expect(await fbt.balanceOf(manager1.address)).to.equal(managerFee);
    expect(await fbt.balanceOf(seller.address)).to.equal(
      originalBalance + price - platFormFee - managerFee
    );
  });
});
