const { expect } = require("chai");
const hre = require("hardhat");
const {
  deployNFTGatewayAndNFTFactory,
  deployVestingPPN,
} = require("../lib/deploy");
const { calculateCreate2AddressBasicERC721 } = require("../lib/create2.js");

describe("Test Vesting PPN ..........", function () {
  let gateway, factory, someNFTAddress;

  const startTime = 1700000000;
  const oneHour = 60 * 60;
  const oneDay = 24 * oneHour;
  const sevenDays = 7 * oneDay;

  const periodStartTime = [
    startTime + 0,
    startTime + oneHour,
    startTime + oneDay,
    startTime + sevenDays,
  ];

  const unlockQuantity = [2000, 4000, 6000, 8000];

  const ppnId0 = 1000;
  const ppnId1 = 2001;
  const ppnId2 = 4001;
  const ppnId3 = 6001;
  const ppnId4 = 8001;

  beforeEach("contracts deployed.", async function () {
    await hre.network.provider.send("hardhat_reset");

    [owner, manager0, gatewayAdmin, u1, u2, u3, u4] =
      await hre.ethers.getSigners();

    // Set up ERC721 contract
    ({ gateway, factory } = await deployNFTGatewayAndNFTFactory(gatewayAdmin));
    const from = factory.address;
    const deployeeName = "BasicERC721";
    const tokenName = "SomeERC721";
    const tokenSymbol = "SNFT";
    const baseURI = "baseURI";
    const salt = 233;
    someNFTAddress = await calculateCreate2AddressBasicERC721(
      from,
      deployeeName,
      tokenName,
      tokenSymbol,
      baseURI,
      gateway.address,
      salt
    );
    await factory
      .connect(manager0)
      .deployBaseERC721(tokenName, tokenSymbol, baseURI, salt);

    someERC721Contract = await hre.ethers.getContractAt(
      "BasicERC721",
      someNFTAddress
    );

    vp = await deployVestingPPN(
      owner.address,
      someNFTAddress,
      periodStartTime,
      unlockQuantity
    );
  });

  it("Test Period 0 & 1 & 2 & 3 & ....", async function () {
    //period 0 start
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      periodStartTime[0],
    ]);
    await vp.transferManagement(owner.address);
    expect(await vp.manager()).to.equal(owner.address);
    expect(await vp.maxUnlockId()).to.equal(unlockQuantity[0]);

    //period 1 start
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      periodStartTime[1],
    ]);
    await vp.transferManagement(owner.address);
    expect(await vp.maxUnlockId()).to.equal(unlockQuantity[1]);

    //period 2 start
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      periodStartTime[2],
    ]);
    await vp.transferManagement(owner.address);
    expect(await vp.maxUnlockId()).to.equal(unlockQuantity[2]);

    //period 3 start
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      periodStartTime[3],
    ]);
    await vp.transferManagement(owner.address);
    expect(await vp.maxUnlockId()).to.equal(unlockQuantity[3]);

    // after last period
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      2 * periodStartTime[3],
    ]);
    await vp.transferManagement(owner.address);
    expect(await vp.maxUnlockId()).to.equal(unlockQuantity[3]);
  });

  it("Test claim", async function () {
    // Speed up the clock to the second period 1
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      periodStartTime[0],
    ]);

    // send vp some ppn first (all ppn should locked at vp contract at the first time)
    // Id0 - Id3 mint to vp
    await gateway
      .connect(manager0)
      .ERC721_mint(someNFTAddress, vp.address, ppnId0);
    await gateway
      .connect(manager0)
      .ERC721_mint(someNFTAddress, vp.address, ppnId1);
    await gateway
      .connect(manager0)
      .ERC721_mint(someNFTAddress, vp.address, ppnId2);
    await gateway
      .connect(manager0)
      .ERC721_mint(someNFTAddress, vp.address, ppnId3);

    // Id4 mint to manager0
    await gateway
      .connect(manager0)
      .ERC721_mint(someNFTAddress, manager0.address, ppnId4);
    expect(await someERC721Contract.ownerOf(ppnId0)).to.equal(vp.address);

    //claim
    await expect(vp.connect(u1).claim(ppnId0, u1.address)).to.be.revertedWith(
      "VestingPPN: not manager"
    );

    await expect(
      vp.connect(owner).claim(ppnId4, u1.address)
    ).to.be.revertedWith("VestingNFT: nft not owned by contract");

    await expect(
        vp.connect(owner).claim(ppnId1, u1.address)
    ).to.be.revertedWith("VestingNFT: nft has not been released");
  
    // Id0 from pv to u1 
    await vp.connect(owner).claim(ppnId0, u1.address)
    expect(await someERC721Contract.ownerOf(ppnId0)).to.equal(u1.address);



    // Speed up the clock to the second period 1
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
        periodStartTime[3],
    ]);

    await vp.connect(owner).claimBatch([ppnId1, ppnId2, ppnId3], u2.address)
    expect(await someERC721Contract.ownerOf(ppnId1)).to.equal(u2.address);
    expect(await someERC721Contract.ownerOf(ppnId2)).to.equal(u2.address);
    expect(await someERC721Contract.ownerOf(ppnId3)).to.equal(u2.address);
  });
});
