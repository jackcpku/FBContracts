const { expect } = require("chai");
const { BigNumber } = require("ethers");
const hre = require("hardhat");
const {
  deployLootBox,
  deployNFTGatewayAndNFTFactory,
} = require("../lib/deploy.js");
const {
  calculateCreate2AddressBasicERC721,
  calculateCreate2AddressBasicERC1155,
} = require("../lib/create2.js");

// TODO

describe("Test LootBox Contract", function () {
  let lootBox, factory, gateway, u2Contract;

  beforeEach("Deploy contracts", async function () {
    // Reset test environment.
    await hre.network.provider.send("hardhat_reset");

    [
      owner,
      gatewayAdmin,
      newGatewayAdmin,
      u2,
      u3,
      u4,
      gatewayManager3,
      u5,
      u6,
    ] = await hre.ethers.getSigners();

    ({ gateway, factory } = await deployNFTGatewayAndNFTFactory(gatewayAdmin));

    lootBox = await deployLootBox();

    // Deploy ERC721 contract

    const from = factory.address;
    const deployeeName = "BasicERC721";
    const tokenName = "U2-contract";
    const tokenSymbol = "U2T";
    const baseURI = "baseURI";
    const salt = 233;
    const u2ContractAddress = await calculateCreate2AddressBasicERC721(
      from,
      deployeeName,
      tokenName,
      tokenSymbol,
      baseURI,
      gateway.address,
      salt
    );

    // Let u2 deploy the contract.
    await factory
      .connect(u2)
      .deployBasicERC721(tokenName, tokenSymbol, baseURI, salt);
    u2Contract = await hre.ethers.getContractAt(
      "BasicERC721",
      u2ContractAddress
    );
    expect(await u2Contract.gateway()).to.equal(gateway.address);
  });

  it.skip("should pass test", async function () {
    this.timeout(100000);

    await lootBox.initialize(u2Contract.address, 1, 2000);

    let randoms = [];
    for (let i = 1; i <= 2000; i++) {
      if (i % 100 == 0) {
        console.log(`Done ${i} iterations`);
      }
      const tx = await lootBox.mintLootBox(u2Contract.address, 0);
      const rc = await tx.wait();
      const event = rc.events.find((event) => event.event === "GetRandomIndex");
      const random = BigNumber.from(event["topics"][2]);
      randoms = [...randoms, random];
    }
    randoms = randoms.map((x) => x.toNumber());
    randoms = randoms.sort((a, b) => a - b);

    const should_get = [...Array(2000).keys()].map((x) => x + 1);

    expect(randoms).deep.to.equal(should_get);

    // This should emit "Full" event.
    const tx = await lootBox.getRandom();
    const rc = await tx.wait();
    const event = rc.events.find((event) => event.event === "Full");
    expect(event["args"]["sender"]).to.equal(
      (await hre.ethers.getSigner()).address
    );
  });
});
