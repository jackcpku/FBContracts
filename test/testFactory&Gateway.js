const { expect } = require("chai");
const hre = require("hardhat");


describe("Test Factory & Gateway Contract", function () {
  let gateway, factory;
  let owner, gatewayManager, newGatewayManager, u2, u3, u4, anotherFactory, evenAnotherFactory;

  beforeEach("Deploy contracts", async function () {
    // Reset test environment.
    await hre.network.provider.send("hardhat_reset");

    [owner, gatewayManager, newGatewayManager, u2, u3, u4, anotherFactory, evenAnotherFactory] = await hre.ethers.getSigners();

    // First deploy Gateway contract.
    const GateWay = await hre.ethers.getContractFactory("Gateway");
    gateway = await hre.upgrades.deployProxy(GateWay, [gatewayManager.address]);
    await gateway.deployed();

    // Then deploy Factory contract using gateway address.
    const Factory = await hre.ethers.getContractFactory("Factory");
    factory = await hre.upgrades.deployProxy(Factory, [gateway.address]);
    await factory.deployed();

    // Register factory address in the gateway contract.
    await gateway.connect(gatewayManager).setFactoryAddress(factory.address);
  });

  it("Should deploy a new contract on behalf of u2", async function () {
    // Similate the call to obtain the return value.
    let u2ContractAddress = await factory.connect(u2).callStatic.deployBasicERC721("U2-contract", "U2T");

    // Let u2 deploy the contract.
    await factory.connect(u2).deployBasicERC721("U2-contract", "U2T");
    let u2Contract = await hre.ethers.getContractAt("BasicERC721", u2ContractAddress);
    expect(await u2Contract.gateway()).to.equal(gateway.address);
  });

  describe("Access control", function () {
    let u2Contract, u3Contract;
    beforeEach("Deploy contracts on behalf of u2 & u3", async function () {
      let u2ContractAddress = await factory.connect(u2).callStatic.deployBasicERC721("U2-contract", "U2T");
      await factory.connect(u2).deployBasicERC721("U2-contract", "U2T");
      u2Contract = await hre.ethers.getContractAt("BasicERC721", u2ContractAddress);

      let u3ContractAddress = await factory.connect(u3).callStatic.deployBasicERC721("U3-contract", "U3T");
      await factory.connect(u3).deployBasicERC721("U3-contract", "U3T");
      u3Contract = await hre.ethers.getContractAt("BasicERC721", u3ContractAddress);
    });

    it("u2 should be able to mint and seturi on U2-contract through gateway", async function () {
      await gateway.connect(u2).mint(u2Contract.address, u2.address, "u2NFT00");
      await gateway.connect(u2).mint(u2Contract.address, u2.address, "u2NFT01");
      await gateway.connect(u2).mint(u2Contract.address, u2.address, "u2NFT02");

      await gateway.connect(u2).setTokenURI(u2Contract.address, 1, "u2NFT01-modified");

      expect(await u2Contract.tokenURI(0)).to.equal("u2NFT00");
      expect(await u2Contract.tokenURI(1)).to.equal("u2NFT01-modified");
      expect(await u2Contract.tokenURI(2)).to.equal("u2NFT02");
    });

    it("u2 should not be able to mint and seturi on U3-contract through gateway", async function () {
      await expect(gateway.connect(u2).mint(u3Contract.address, u2.address, "u3NFT01")).to.be.revertedWith("Unauthorized");

      await gateway.connect(u3).mint(u3Contract.address, u3.address, "u3NFT01");
      await expect(gateway.connect(u2).setTokenURI(u3Contract.address, 1, "u3NFT01-modified")).to.be.revertedWith("Unauthorized");
    });

    it("Gateway manager should not be able to mint on U2-contract", async function () {
      await expect(gateway.connect(gatewayManager).mint(u2Contract.address, u2.address, "u2NFT01")).to.be.revertedWith("Unauthorized");
    });

    it("u2 should not be able to set gateway of U2-contract", async function () {
      // Either through its own contract
      expect(u2Contract.connect(u2).setGateway(u2.address)).to.be.reverted;

      // Or through gateway contract
      expect(gateway.connect(u2).setGatewayOf(u2Contract.address, u2.address)).to.be.reverted;
    });

    it("Gateway manager should be able to set a new gateway of U2-contract only through gateway contract", async function () {
      // Fail: through u2 contract
      expect(u2Contract.connect(gatewayManager).setGateway(u2.address)).to.be.reverted;

      // Fail: new gateway address same as the previous one
      await expect(gateway.connect(gatewayManager).setGatewayOf(u2Contract.address, gateway.address))
        .to.be.revertedWith("Should assign a different gateway");

      // Success: through gateway contract
      await gateway.connect(gatewayManager).setGatewayOf(u2Contract.address, u2.address);
    });

    it("Grace period works", async function () {
      // Transfer ownership to newGatewayManager
      await gateway.connect(gatewayManager).transferGatewayOwnership(newGatewayManager.address);

      // The previous gatewaymanager is still able to do a lot of things, 
      // not including transferring again, though.
      await gateway.connect(gatewayManager).setFactoryAddress(anotherFactory.address);
      expect(gateway.connect(gatewayManager).transferGatewayOwnership(u3.address)).to.be.reverted;

      // The new gatewayManager picked up his role.
      await gateway.connect(newGatewayManager).setFactoryAddress(evenAnotherFactory.address);

      // Let newGatewayManager set a new manager for u2Contract
      await gateway.connect(newGatewayManager).setManagerOf(u2Contract.address, u4.address);

      // u2 will not be able to mint any more
      expect(gateway.connect(u2).mint(u2Contract.address, u2.address, "")).to.be.reverted;

      // u4 can mint
      await gateway.connect(u4).mint(u2Contract.address, u4.address, "u4-nft");

      // Speed up the clock to skip the grace period.
      await hre.network.provider.send("evm_increaseTime", [100000]);

      // After the grace period expires, gatewayManager should not be authorized to 
      // 1. Set manager of a certain contract
      // 2. Set gateway of a certain contract
      // 3. Set the factory address
      await expect(gateway.connect(gatewayManager).setManagerOf(u2Contract.address, u4.address)).to.be.revertedWith("Only gateway manager and factory contract are authorized");
      await expect(gateway.connect(gatewayManager).setGatewayOf(u2Contract.address, u3.address)).to.be.revertedWith("Only admin");
      await expect(gateway.connect(gatewayManager).setFactoryAddress(evenAnotherFactory.address)).to.be.revertedWith("Only admin");
    });
  });
});
