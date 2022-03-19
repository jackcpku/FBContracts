const { expect } = require("chai");
const hre = require("hardhat");
const {
  deployMajorToken,
  deployNFTGatewayAndNFTFactory,
  deployDividend,
} = require("../lib/deploy");

describe("Test NFT Dividend..........", function () {
  let pvs, dd, gateway, factory;

  const p1pvs = BigInt(1000000);
  const p2pvs = BigInt(400000);
  const p3pvs = BigInt(60000);

  const p1Amt = BigInt(2000);
  const p2Amt = BigInt(2000);
  const p3Amt = BigInt(2000);

  const u2nftId = 222;

  let nftContractAddress;

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

  beforeEach("contracts deployed.", async function () {
    await hre.network.provider.send("hardhat_reset");

    [owner, gatewayAdmin, u1, u2, u3, u4] = await hre.ethers.getSigners();
    pvs = await deployMajorToken(owner.address);

    //deploy nft factory
    ({ gateway, factory } = await deployNFTGatewayAndNFTFactory(gatewayAdmin));
    // Similate the call to obtain the return value.
    nftContractAddress = await factory
      .connect(u2)
      .callStatic.deployBasicERC721("U2-contract", "U2T", "", BigInt(0));

    dd = await deployDividend(pvs.address, nftContractAddress, periodStartTime);

    //set start time for our blockchian
    await hre.network.provider.send("evm_setNextBlockTimestamp", [startTime]);
  });

  it("Test Period 1 :", async function () {
    expect(await dd.totalDividend(1)).to.equal(0);
    await expect(dd.totalDividend(2001)).to.be.revertedWith(
      "Dividend: tokenId exceeded limit"
    );
    //add p1pvs to pool[1]
    await pvs.transfer(dd.address, p1pvs);
    expect(await dd.totalDividend(1)).to.equal(p1pvs / p1Amt);
  });

  it("Test Period 2 :", async function () {
    // add p1pvs to pool[1]
    await pvs.transfer(dd.address, p1pvs);

    const block = await hre.ethers.provider.getBlock("latest");
    await expect(dd.updatePeriod(1)).to.be.revertedWith(
      "Dividend: the next period has not yet begun"
    );

    // Speed up the clock to the second period
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      startTime + periodStartTime[1],
    ]);
    // period 2 begin
    await dd.updatePeriod(1);
    await expect(dd.updatePeriod(0)).to.be.revertedWith(
      "Dividend: the new period must be exactly one period after the present"
    );
    //add p2pvs to pool[2]
    await pvs.transfer(dd.address, p2pvs);
    expect(await dd.totalDividend(1)).to.equal(
      p1pvs / p1Amt + p2pvs / (p1Amt + p2Amt)
    );

    expect(await dd.totalDividend(2001)).to.equal(p2pvs / (p1Amt + p2Amt));
  });

  it("Test Period 3 :", async function () {
    //add p1pvs to pool[1]
    await pvs.transfer(dd.address, p1pvs);

    // Speed up the clock to the second period
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      startTime + periodStartTime[1],
    ]);
    //period 2 begin
    await dd.updatePeriod(1);
    //add p2pvs to pool[2]
    await pvs.transfer(dd.address, p2pvs);

    // Speed up the clock to the second period
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      startTime + periodStartTime[2],
    ]);
    //period 3 begin
    await dd.updatePeriod(2);
    await pvs.transfer(dd.address, p3pvs);

    expect(await dd.totalDividend(1)).to.equal(
      p1pvs / p1Amt + p2pvs / (p1Amt + p2Amt) + p3pvs / (p1Amt + p2Amt + p3Amt)
    );

    expect(await dd.totalDividend(2002)).to.equal(
      p2pvs / (p1Amt + p2Amt) + p3pvs / (p1Amt + p2Amt + p3Amt)
    );

    expect(await dd.totalDividend(5000)).to.equal(
      p3pvs / (p1Amt + p2Amt + p3Amt)
    );
  });

  it("Test claim", async function () {
    //add p1pvs to pool[1]
    await pvs.transfer(dd.address, p1pvs);
    // Speed up the clock to the second period
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      startTime + periodStartTime[1],
    ]);
    //period 2 begin
    await dd.updatePeriod(1);
    //add p2pvs to pool[2]
    await pvs.transfer(dd.address, p2pvs);
    // Speed up the clock to the second period
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      startTime + periodStartTime[2],
    ]);
    //period 3 begin
    await dd.updatePeriod(2);
    await pvs.transfer(dd.address, p3pvs);

    // Let u2 deploy the contract.
    let u2Contract = await hre.ethers.getContractAt(
      "BasicERC721",
      nftContractAddress
    );
    // Let u2 deploy the contract.
    await factory
      .connect(u2)
      .deployBasicERC721("U2-contract", "U2T", "", BigInt(0));
    await gateway
      .connect(u2)
      .ERC721_mint(nftContractAddress, u2.address, u2nftId);
    expect(await u2Contract.ownerOf(u2nftId)).to.equal(u2.address);

    //claim
    await expect(dd.connect(u1).claim(u2nftId)).to.be.revertedWith(
      "Dividend: Can't claim dividend because you are not the owner of the nft"
    );
    expect(await dd.connect(u2).claim(u2nftId))
      .to.emit(dd, "Claim")
      .withArgs(u2.address, u2nftId, await dd.totalDividend(u2nftId));
    expect(await dd.connect(u2).remainDividend(u2nftId)).to.equal(0);

    //claim Batch
    const u2nftId1 = 100,
      u2nftId2 = 2200,
      u2nftId3 = 4500;
    await gateway
      .connect(u2)
      .ERC721_mint(nftContractAddress, u2.address, u2nftId1);
    await gateway
      .connect(u2)
      .ERC721_mint(nftContractAddress, u2.address, u2nftId2);
    await gateway
      .connect(u2)
      .ERC721_mint(nftContractAddress, u2.address, u2nftId3);
    const claimBatchEvent = await dd
      .connect(u2)
      .claimBatch([u2nftId1, u2nftId2, u2nftId3]);
    expect(claimBatchEvent)
      .to.emit(dd, "Claim")
      .withArgs(u2.address, u2nftId1, await dd.totalDividend(u2nftId1));
    expect(claimBatchEvent)
      .to.emit(dd, "Claim")
      .withArgs(u2.address, u2nftId2, await dd.totalDividend(u2nftId2));
    expect(claimBatchEvent)
      .to.emit(dd, "Claim")
      .withArgs(u2.address, u2nftId3, await dd.totalDividend(u2nftId3));
  });
});
