const { expect } = require("chai");
const { BigNumber } = require("ethers");
const hre = require("hardhat");
const {
  deploySimpleLootBoxRegistry,
  deployNFTGatewayAndNFTFactory,
} = require("../lib/deploy.js");
const {
  calculateCreate2AddressBasicERC721,
  calculateCreate2AddressBasicERC1155,
} = require("../lib/create2.js");

// TODO

describe("Test LootBox Contract", function () {
  let lootBox, factory, gateway, basicERC721Contract, basicERC1155Contract;

  beforeEach("Deploy contracts", async function () {
    // Reset test environment.
    await hre.network.provider.send("hardhat_reset");

    [owner, gatewayAdmin, newGatewayAdmin, nftManager] =
      await hre.ethers.getSigners();

    ({ gateway, factory } = await deployNFTGatewayAndNFTFactory(gatewayAdmin));

    lootBox = await deploySimpleLootBoxRegistry(gateway.address);

    {
      // Deploy BasicERC721 contract
      const from = factory.address;
      const deployeeName = "BasicERC721";
      const tokenName = "U2-contract";
      const tokenSymbol = "U2T";
      const baseURI = "baseURI";
      const salt = 233;
      const basicERC721ContractAddress =
        await calculateCreate2AddressBasicERC721(
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
        .connect(nftManager)
        .deployBasicERC721(tokenName, tokenSymbol, baseURI, salt);
      basicERC721Contract = await hre.ethers.getContractAt(
        "BasicERC721",
        basicERC721ContractAddress
      );
      expect(await basicERC721Contract.gateway()).to.equal(gateway.address);
    }

    {
      // Deploy BasicERC1155 contract
      const from = factory.address;
      const deployeeName = "BasicERC1155";
      const uri = "some uri";
      const salt = 233;
      const basicERC1155ContractAddress =
        await calculateCreate2AddressBasicERC1155(
          from,
          deployeeName,
          uri,
          gateway.address,
          salt
        );

      // Let nftManager deploy the contract.
      await factory.connect(nftManager).deployBasicERC1155(uri, salt);
      basicERC1155Contract = await hre.ethers.getContractAt(
        deployeeName,
        basicERC1155ContractAddress
      );
      expect(await basicERC1155Contract.gateway()).to.equal(gateway.address);
    }
  });

  it("should pass integration test", async function () {
    this.timeout(30 * 1000);

    const lootBoxSize = 100;
    const basicERC1155TokenId = 1;
    const lowerBound = 1;
    const upperBound = 100;

    // 1. Mint some erc1155 tokens
    gateway
      .connect(nftManager)
      .ERC1155_mint(
        basicERC1155Contract.address,
        nftManager.address,
        basicERC1155TokenId,
        lootBoxSize,
        "0x"
      );

    // 2. Add lootbox to the whitelist
    await gateway.connect(gatewayAdmin).addOperatorWhitelist(lootBox.address);

    // 3. Config the lootbox
    await lootBox.configLootBox(
      basicERC721Contract.address,
      lowerBound,
      upperBound,
      basicERC1155Contract.address,
      basicERC1155TokenId
    );

    let randoms = [];
    for (let i = 1; i <= lootBoxSize; i++) {
      // 4. LootBox gambler approves the lootbox of spending
      await basicERC1155Contract
        .connect(nftManager)
        .setApprovalForAll(lootBox.address, true);

      // 5. LootBox gambler unwraps the lootbox
      const tx = await lootBox
        .connect(nftManager)
        .unwrapLootBox(basicERC1155Contract.address, basicERC1155TokenId);
      const rc = await tx.wait();
      const event = rc.events.find((event) => event.event === "UnwrapLootBox");
      const random = BigNumber.from(event["topics"][2]);
      randoms = [...randoms, random];
    }
    randoms = randoms.map((x) => x.toNumber());
    randoms = randoms.sort((a, b) => a - b);

    const should_get = [...Array(lootBoxSize).keys()].map((x) => x + 1);

    expect(randoms).deep.to.equal(should_get);
  });
});
