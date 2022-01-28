const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const { deployNFTGatewayAndNFTFactory } = require('../lib/deploy.js');


describe("Test Marketplace Contract", function () {
  // Contracts
  let gateway, factory, marketplace, fbt;
  let nftContract1;  // NFT contract deployed by manager1.
  let nftContract2;  // NFT contract deployed by manager2.
  let exoticNftContract;  // NFT contract deployed by exoticManager.
  // Addresses
  let owner, gatewayAdmin;
  let platform;  // The Big Brother
  let manager1, manager2, exoticManager;  // Game providers
  let user1, user2, user3, randomUser;  // Riders

  let originalBalance;
  let fees;

  beforeEach("Initialize environment", async function () {
    // Reset the environment.
    await hre.network.provider.send("hardhat_reset");

    [owner, gatewayAdmin, platform, manager1, manager2, exoticManager, user1, user2, user3, randomUser] = await hre.ethers.getSigners();

    // Deploy FBT contract.
    const FunBoxToken = await hre.ethers.getContractFactory("FunBoxToken");
    fbt = await FunBoxToken.deploy();
    await fbt.deployed();

    // Send fbt to users.
    originalBalance = 1000000;
    await fbt.transfer(user1.address, originalBalance);
    await fbt.transfer(user2.address, originalBalance);

    // Deploy Gateway and Factory contract.
    ({ gateway, factory } = await deployNFTGatewayAndNFTFactory(gatewayAdmin));

    // Let managers deploy nft contracts.
    let nftContract1Address = await factory.connect(manager1).callStatic.deployBasicERC721("nft-contract-1", "UC1");
    await factory.connect(manager1).deployBasicERC721("nft-contract-1", "UC1");
    nftContract1 = await hre.ethers.getContractAt("BasicERC721", nftContract1Address);

    let nftContract2Address = await factory.connect(manager2).callStatic.deployBasicERC721("nft-contract-2", "UC2");
    await factory.connect(manager2).deployBasicERC721("nft-contract-2", "UC2");
    nftContract2 = await hre.ethers.getContractAt("BasicERC721", nftContract2Address);

    let ExoticNftContract = await hre.ethers.getContractFactory("ExoticNFT");
    exoticNftContract = await ExoticNftContract.connect(exoticManager).deploy("Some NFT", "SNFT");
    await exoticNftContract.deployed();

    // Deploy the marketplace contract.
    const Marketplace = await hre.ethers.getContractFactory("Marketplace");
    marketplace = await hre.upgrades.deployProxy(Marketplace, []);
    await marketplace.deployed();

    // Initialize the marketplace contract.
    await marketplace.setNftGateway(gateway.address);
    await marketplace.setPaymentTokens([fbt.address]);
    fees = [5000, 300, 200];
    await marketplace.setFees(fees);
    await marketplace.setPlatformAddress(platform.address);
    await marketplace.setFallbackManager(exoticNftContract.address, exoticManager.address);

    // Manager1 mints an NFT to user1.
    await gateway.connect(manager1).mint(nftContract1.address, user1.address, "Some URI");
  });

  it("Direct buy: succeeded", async function () {
    /**
     * 1. user1 puts a sell bid on the market
     * 2. user2 matches that bid, buys directly
     */

    // Get user1's nft tokenId
    const user1Balance = await nftContract1.balanceOf(user1.address);
    expect(user1Balance).to.equal(1);
    const tokenId = await nftContract1.tokenOfOwnerByIndex(user1.address, 0);

    // user1 signs the sell bid
    const saltNonce = "0x0000000000000000000000000000000000000000000000000000000195738188";
    const price = 1000;
    const criteriaMessageHash = ethers.utils.solidityKeccak256(
      ["address", "uint256", "address", "uint256", "bytes"],
      [
        nftContract1.address, // nft contract address
        tokenId,              // tokenId
        fbt.address,          // payment token contract
        price,                // price
        saltNonce             // saltNonce
      ]
    );
    const u1Sig = await user1.signMessage(ethers.utils.arrayify(criteriaMessageHash));

    // (nftContract1.address, tokenId, fbt.address, price, saltNonce, u1Sig) saved in database

    /**
     * Transaction preparations.
     * 1. Seller approves the marketplace contract of spending `tokenId`.
     * 2. Buyer approves the marketplace contract of spending `price` amount.
     */
    await nftContract1.connect(user1).approve(marketplace.address, tokenId);
    await fbt.connect(user2).approve(marketplace.address, price);

    // user2 buys the nft directly
    await marketplace.connect(user2).buy(
      nftContract1.address,
      tokenId,
      fbt.address,
      price,
      saltNonce,
      user1.address,
      u1Sig
    );

    // The same signature should not be used more than once.
    await expect(marketplace.connect(user2).buy(
      nftContract1.address,
      tokenId,
      fbt.address,
      price,
      saltNonce,
      user1.address,
      u1Sig
    )).to.be.revertedWith("Marketplace: signature used");

    /**
     * Checks
     */
    const platFormFee = price * fees[1] / 10000;
    const managerFee = price * fees[2] / 10000;
    expect(await fbt.balanceOf(user2.address)).to.equal(originalBalance - price);
    expect(await fbt.balanceOf(platform.address)).to.equal(platFormFee);
    expect(await fbt.balanceOf(manager1.address)).to.equal(managerFee);
    expect(await fbt.balanceOf(user1.address)).to.equal(originalBalance + price - platFormFee - managerFee);
  });

  it("should fail if buyer calls buy with a wrong price", async function () {
    /**
     * 1. user1 puts a sell bid on the market
     * 2. user2 matches that bid, buys directly
     */

    // Get user1's nft tokenId
    const user1Balance = await nftContract1.balanceOf(user1.address);
    expect(user1Balance).to.equal(1);
    const tokenId = await nftContract1.tokenOfOwnerByIndex(user1.address, 0);

    // user1 signs the sell bid
    const saltNonce = "0x0000000000000000000000000000000000000000000000000000000195738188";
    const price = 1000;
    const criteriaMessageHash = ethers.utils.solidityKeccak256(
      ["address", "uint256", "address", "uint256", "bytes"],
      [
        nftContract1.address, // nft contract address
        tokenId,              // tokenId
        fbt.address,          // payment token contract
        price,                // price
        saltNonce             // saltNonce
      ]
    );
    const u1Sig = await user1.signMessage(ethers.utils.arrayify(criteriaMessageHash));

    // (nftContract1.address, tokenId, fbt.address, price, saltNonce, u1Sig) saved in database

    /**
     * Transaction preparations.
     * 1. Seller approves the marketplace contract of spending `tokenId`.
     * 2. Buyer approves the marketplace contract of spending `price` amount.
     */
    await nftContract1.connect(user1).approve(marketplace.address, tokenId);
    await fbt.connect(user2).approve(marketplace.address, price);

    // user2 buys the nft directly
    await expect(marketplace.connect(user2).buy(
      nftContract1.address,
      tokenId,
      fbt.address,
      price - 100,
      saltNonce,
      user1.address,
      u1Sig
    )).to.be.revertedWith("Marketplace: invalid seller signature");
  });

  it("Direct buy (seller is manager): succeeded", async function () {
    /**
     * 1. user1 puts a sell bid on the market
     * 2. user2 matches that bid, buys directly
     */

    // Manager mints a token to himself
    await gateway.connect(manager1).mint(nftContract1.address, manager1.address, "Some URI");
    const manager1Balance = await nftContract1.balanceOf(manager1.address);
    expect(manager1Balance).to.equal(1);
    const tokenId = await nftContract1.tokenOfOwnerByIndex(manager1.address, 0);


    // manager1 signs the sell bid
    const saltNonce = "0x0000000000000000000000000000000000000000000000000000000195738189";
    const price = 1000;
    const criteriaMessageHash = ethers.utils.solidityKeccak256(
      ["address", "uint256", "address", "uint256", "bytes"],
      [
        nftContract1.address, // nft contract address
        tokenId,              // tokenId
        fbt.address,          // payment token contract
        price,                // price
        saltNonce             // saltNonce
      ]
    );
    const m1Sig = await manager1.signMessage(ethers.utils.arrayify(criteriaMessageHash));

    // (nftContract1.address, tokenId, fbt.address, price, saltNonce, m1Sig) saved in database

    /**
     * Transaction preparations.
     * 1. Seller approves the marketplace contract of spending `tokenId`.
     * 2. Buyer approves the marketplace contract of spending `price` amount.
     */
    await nftContract1.connect(manager1).approve(marketplace.address, tokenId);
    await fbt.connect(user2).approve(marketplace.address, price);

    // user2 buys the nft directly
    await marketplace.connect(user2).buy(
      nftContract1.address,
      tokenId,
      fbt.address,
      price,
      saltNonce,
      manager1.address,
      m1Sig
    );

    /**
     * Checks
     */
    const platFormFee = price * fees[0] / 10000;
    expect(await fbt.balanceOf(user2.address)).to.equal(originalBalance - price);
    expect(await fbt.balanceOf(platform.address)).to.equal(platFormFee);
    expect(await fbt.balanceOf(manager1.address)).to.equal(price - platFormFee);
  });

  it("Direct buy (contract is exotic): succeeded", async function () {
    // Exotic manager mints to user1
    await exoticNftContract.connect(exoticManager).mint(user1.address, "Some URI");

    /**
     * 1. user1 puts a sell bid on the market
     * 2. user2 matches that bid, buys directly
     */

    // Get user1's nft tokenId
    const user1Balance = await exoticNftContract.balanceOf(user1.address);
    expect(user1Balance).to.equal(1);
    const tokenId = await exoticNftContract.tokenOfOwnerByIndex(user1.address, 0);

    // user1 signs the sell bid
    const saltNonce = "0x0000000000000000000000000000000000000000000000000000000195738198";
    const price = 1000;
    const criteriaMessageHash = ethers.utils.solidityKeccak256(
      ["address", "uint256", "address", "uint256", "bytes"],
      [
        exoticNftContract.address, // nft contract address
        tokenId,              // tokenId
        fbt.address,          // payment token contract
        price,                // price
        saltNonce             // saltNonce
      ]
    );
    const u1Sig = await user1.signMessage(ethers.utils.arrayify(criteriaMessageHash));

    // (exoticNftContract.address, tokenId, fbt.address, price, saltNonce, u1Sig) saved in database

    /**
     * Transaction preparations.
     * 1. Seller approves the marketplace contract of spending `tokenId`.
     * 2. Buyer approves the marketplace contract of spending `price` amount.
     */
    await exoticNftContract.connect(user1).approve(marketplace.address, tokenId);
    await fbt.connect(user2).approve(marketplace.address, price);

    // user2 buys the nft directly
    await marketplace.connect(user2).buy(
      exoticNftContract.address,
      tokenId,
      fbt.address,
      price,
      saltNonce,
      user1.address,
      u1Sig
    );

    /**
     * Checks
     */
    const platFormFee = price * fees[1] / 10000;
    const managerFee = price * fees[2] / 10000;
    expect(await fbt.balanceOf(user2.address)).to.equal(originalBalance - price);
    expect(await fbt.balanceOf(platform.address)).to.equal(platFormFee);
    expect(await fbt.balanceOf(exoticManager.address)).to.equal(managerFee);
    expect(await fbt.balanceOf(user1.address)).to.equal(originalBalance + price - platFormFee - managerFee);
  });

  it("Delegated buy: succeeded", async function () {
    /**
     * 1. user1 puts a sell bid on the market, sends a signature of sell bid
     * 2. user2 matches that bid, sends a signature of buy bid
     * 3. anyone with user1's and user2's signatures matches the transaction
     */

    // Get user1's nft tokenId
    const user1Balance = await nftContract1.balanceOf(user1.address);
    expect(user1Balance).to.equal(1);
    const tokenId = await nftContract1.tokenOfOwnerByIndex(user1.address, 0);

    // user1 signs the sell bid
    const saltNonce = "0x0000000000000000000000000000000000000000000000000000000195738189";
    const price = 1000;
    const criteriaMessageHash = ethers.utils.solidityKeccak256(
      ["address", "uint256", "address", "uint256", "bytes"],
      [
        nftContract1.address, // nft contract address
        tokenId,              // tokenId
        fbt.address,          // payment token contract
        price,                // price
        saltNonce             // saltNonce
      ]
    );
    const u1Sig = await user1.signMessage(ethers.utils.arrayify(criteriaMessageHash));

    // (nftContract1.address, tokenId, fbt.address, price, saltNonce, u1Sig) saved in database

    // user2 signs the buy bid
    const u2Sig = await user2.signMessage(ethers.utils.arrayify(criteriaMessageHash));

    /**
     * Transaction preparations.
     * 1. Seller approves the marketplace contract of spending `tokenId`.
     * 2. Buyer approves the marketplace contract of spending `price` amount.
     */
    await nftContract1.connect(user1).approve(marketplace.address, tokenId);
    await fbt.connect(user2).approve(marketplace.address, price);

    // user3 helps trigger the transaction
    await marketplace.connect(user3).delegatedBuy(
      nftContract1.address,
      tokenId,
      fbt.address,
      price,
      saltNonce,
      user1.address,
      u1Sig,
      user2.address,
      u2Sig
    );

    /**
     * Checks
     */
    const platFormFee = price * fees[1] / 10000;
    const managerFee = price * fees[2] / 10000;
    expect(await fbt.balanceOf(user2.address)).to.equal(originalBalance - price);
    expect(await fbt.balanceOf(platform.address)).to.equal(platFormFee);
    expect(await fbt.balanceOf(manager1.address)).to.equal(managerFee);
    expect(await fbt.balanceOf(user1.address)).to.equal(originalBalance + price - platFormFee - managerFee);
  });

  it("Seller cancels bid: succeeded", async function () {
    /**
     * 1. user1 puts a sell bid on the market
     * 2. user1 cancels the sell bid
     * 3. user2 buys and fails
     */

    // Get user1's nft tokenId
    const user1Balance = await nftContract1.balanceOf(user1.address);
    expect(user1Balance).to.equal(1);
    const tokenId = await nftContract1.tokenOfOwnerByIndex(user1.address, 0);

    // user1 signs the sell bid
    const saltNonce = "0x0000000000000000000000000000000000000000000000000000000195738188";
    const price = 1000;
    const criteriaMessageHash = ethers.utils.solidityKeccak256(
      ["address", "uint256", "address", "uint256", "bytes"],
      [
        nftContract1.address, // nft contract address
        tokenId,              // tokenId
        fbt.address,          // payment token contract
        price,                // price
        saltNonce             // saltNonce
      ]
    );
    const u1Sig = await user1.signMessage(ethers.utils.arrayify(criteriaMessageHash));

    // (nftContract1.address, tokenId, fbt.address, price, saltNonce, u1Sig) saved in database

    // user1 cancels the sell bid
    await marketplace.connect(user1).ignoreSignature(
      nftContract1.address,
      tokenId,
      fbt.address,
      price,
      saltNonce,
      u1Sig
    );

    /**
     * Transaction preparations.
     * 1. Seller approves the marketplace contract of spending `tokenId`.
     * 2. Buyer approves the marketplace contract of spending `price` amount.
     */
    await nftContract1.connect(user1).approve(marketplace.address, tokenId);
    await fbt.connect(user2).approve(marketplace.address, price);

    // user2 buys the nft directly and fails
    await expect(marketplace.connect(user2).buy(
      nftContract1.address,
      tokenId,
      fbt.address,
      price,
      saltNonce,
      user1.address,
      u1Sig
    )).to.be.revertedWith("Marketplace: signature used");
  });

  it("Seller cancels multiple bids: succeeded", async function () {
    /**
     * 1. user1 puts a sell bid on the market
     * 2. user1 puts a lower price sell bid
     * 3. user1 cancels all bids
     * 4. user2 buys and fails
     */

    // Get user1's nft tokenId
    const user1Balance = await nftContract1.balanceOf(user1.address);
    expect(user1Balance).to.equal(1);
    const tokenId = await nftContract1.tokenOfOwnerByIndex(user1.address, 0);

    // user1 signs the sell bid
    const saltNonce1 = "0x0000000000000000000000000000000000000000000000000000000195738188";
    const saltNonce2 = "0x0000000000000000000000000000000000000000000000000000000195738288";
    const price = 1000;
    const criteriaMessageHash1 = ethers.utils.solidityKeccak256(
      ["address", "uint256", "address", "uint256", "bytes"],
      [
        nftContract1.address, // nft contract address
        tokenId,              // tokenId
        fbt.address,          // payment token contract
        price,                // price
        saltNonce1            // saltNonce
      ]
    );
    const u1Sig1 = await user1.signMessage(ethers.utils.arrayify(criteriaMessageHash1));

    const criteriaMessageHash2 = ethers.utils.solidityKeccak256(
      ["address", "uint256", "address", "uint256", "bytes"],
      [
        nftContract1.address, // nft contract address
        tokenId,              // tokenId
        fbt.address,          // payment token contract
        price - 100,          // lower the price
        saltNonce2            // saltNonce
      ]
    );
    const u1Sig2 = await user1.signMessage(ethers.utils.arrayify(criteriaMessageHash2));

    // user1 cancels all bids
    await marketplace.connect(user1).ignoreSignatures(
      nftContract1.address,
      tokenId,
      fbt.address,
      [price, price - 100],
      [saltNonce1, saltNonce2],
      [u1Sig1, u1Sig2]
    );

    /**
     * Transaction preparations.
     * 1. Seller approves the marketplace contract of spending `tokenId`.
     * 2. Buyer approves the marketplace contract of spending `price` amount.
     */
    await nftContract1.connect(user1).approve(marketplace.address, tokenId);
    await fbt.connect(user2).approve(marketplace.address, price);

    // user2 buys the nft directly and fails
    await expect(marketplace.connect(user2).buy(
      nftContract1.address,
      tokenId,
      fbt.address,
      price,
      saltNonce1,
      user1.address,
      u1Sig1
    )).to.be.revertedWith("Marketplace: signature used");

    // user2 buys the nft directly and fails
    await expect(marketplace.connect(user2).buy(
      nftContract1.address,
      tokenId,
      fbt.address,
      price - 100,
      saltNonce2,
      user1.address,
      u1Sig2
    )).to.be.revertedWith("Marketplace: signature used");
  });
});