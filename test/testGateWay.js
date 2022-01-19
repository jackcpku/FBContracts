const { expect } = require("chai");
const hre = require("hardhat");


describe("Test Gateway Contract", function () {
  let basicERC721, gateway, factory;
  let owner, gatewayManager, u2, u3, u4;

  beforeEach("Deploy contracts", async function () {
    // Reset test environment.
    await hre.network.provider.send("hardhat_reset");

    [owner, gatewayManager, u2, u3, u4] = await hre.ethers.getSigners();

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

  it("Sample test", async function () {

  })
})
