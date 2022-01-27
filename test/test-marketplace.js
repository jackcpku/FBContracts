const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const { deployNFTGatewayAndNFTFactory } = require('../lib/deploy.js');


describe("Test Marketplace Contract", function () {
  // Contracts
  let gateway, factory, marketplace, fbt;
  let nftContract1;  // NFT contract deployed by manager1.
  let nftContract2;  // NFT contract deployed by manager2.
  // Addresses
  let owner, gatewayAdmin;
  let platform;  // The Big Brother
  let manager1, manager2;  // Game providers
  let user1, user2, user3;  // Riders

  beforeEach("Initialize environment", async function () {
    // Reset the environment.
    await hre.network.provider.send("hardhat_reset");

    [owner, gatewayAdmin, platform, manager1, manager2, user1, user2, user3] = await hre.ethers.getSigners();

    // Deploy FBT contract.
    const FunBoxToken = await hre.ethers.getContractFactory("FunBoxToken");
    fbt = await FunBoxToken.deploy()
    await fbt.deployed();

    // Send fbt to users.
    await fbt.transfer(user1.address, 1000000);
    await fbt.transfer(user2.address, 1000000);

    // Deploy Gateway and Factory contract.
    ({ gateway, factory } = await deployNFTGatewayAndNFTFactory(gatewayAdmin));

    // Let managers deploy nft contracts.
    let nftContract1Address = await factory.connect(manager1).callStatic.deployBasicERC721("nft-contract-1", "UC1");
    await factory.connect(manager1).deployBasicERC721("nft-contract-1", "UC1");
    nftContract1 = await hre.ethers.getContractAt("BasicERC721", nftContract1Address);

    let nftContract2Address = await factory.connect(manager2).callStatic.deployBasicERC721("nft-contract-2", "UC2");
    await factory.connect(manager2).deployBasicERC721("nft-contract-2", "UC2");
    nftContract2 = await hre.ethers.getContractAt("BasicERC721", nftContract2Address);

    // Deploy the marketplace contract.
    const Marketplace = await hre.ethers.getContractFactory("Marketplace");
    marketplace = await hre.upgrades.deployProxy(Marketplace, []);
    await marketplace.deployed();

    // Initialize the marketplace contract.
    await marketplace.setNftGateway(gateway.address);
    await marketplace.setFees([5000, 300, 200]);

    // Manager1 mints an NFT to user1.
    await gateway.connect(manager1).mint(nftContract1.address, user1.address, "Some URI");
  });

  it("test", async function () {

  });
});