const { expect } = require("chai");
const hre = require("hardhat");
const {
  deployMajorToken,
  deployGatewayAndFactories,
  deployDividend,
} = require("../lib/deploy");

describe("Test NFT Dividend..........", function () {
  let xter, dd, gateway, nftfactory, feeRecipient;

  const p1pvs = BigInt(6_000_000);
  const p2pvs = BigInt(12_000_000);
  const p3pvs = BigInt(18_000_000);

  const NFT_PER_PERIOD = 6000;
  const p1Amt = BigInt(NFT_PER_PERIOD);
  const p2Amt = BigInt(NFT_PER_PERIOD);
  const p3Amt = BigInt(NFT_PER_PERIOD);

  const u2nftId = 222;
  const nftInP2 = 6001;
  const nftInP3 = 12001;

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

  // const serviceFee = 100;

  beforeEach("contracts deployed.", async function () {
    await hre.network.provider.send("hardhat_reset");

    [owner, gatewayAdmin, feeRecipient, u1, u2, u3, u4] =
      await hre.ethers.getSigners();
    xter = await deployMajorToken(owner.address);

    //deploy nft factory
    ({ gateway, nftfactory } = await deployGatewayAndFactories(gatewayAdmin));
    // Similate the call to obtain the return value.
    nftContractAddress = await nftfactory
      .connect(u2)
      .callStatic.deployBasicERC721("U2-contract", "U2T", "", BigInt(0));

    dd = await deployDividend(xter.address, nftContractAddress, periodStartTime);

    //set start time for our blockchian
    await hre.network.provider.send("evm_setNextBlockTimestamp", [startTime]);
  });

  it("Test Period 1 :", async function () {
    expect(await dd.totalDividend(1)).to.equal(0);
    await expect(dd.totalDividend(nftInP2)).to.be.revertedWith(
      "Dividend: tokenId exceeded limit"
    );
    //add p1pvs to pool[1]
    await xter.transfer(dd.address, p1pvs);
    expect(await dd.totalDividend(1)).to.equal(p1pvs / p1Amt);
  });

  it("Test Period 2 :", async function () {
    // add p1pvs to pool[1]
    await xter.transfer(dd.address, p1pvs);

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
    await xter.transfer(dd.address, p2pvs);
    expect(await dd.totalDividend(1)).to.equal(
      p1pvs / p1Amt + p2pvs / (p1Amt + p2Amt)
    );

    expect(await dd.totalDividend(nftInP2)).to.equal(p2pvs / (p1Amt + p2Amt));
  });

  it("Test Period 3 :", async function () {
    //add p1pvs to pool[1]
    await xter.transfer(dd.address, p1pvs);

    // Speed up the clock to the second period
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      startTime + periodStartTime[1],
    ]);
    //period 2 begin
    await dd.updatePeriod(1);
    //add p2pvs to pool[2]
    await xter.transfer(dd.address, p2pvs);

    // Speed up the clock to the second period
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      startTime + periodStartTime[2],
    ]);
    //period 3 begin
    await dd.updatePeriod(2);
    await xter.transfer(dd.address, p3pvs);

    expect(await dd.totalDividend(1)).to.equal(
      p1pvs / p1Amt + p2pvs / (p1Amt + p2Amt) + p3pvs / (p1Amt + p2Amt + p3Amt)
    );

    expect(await dd.totalDividend(nftInP2)).to.equal(
      p2pvs / (p1Amt + p2Amt) + p3pvs / (p1Amt + p2Amt + p3Amt)
    );

    expect(await dd.totalDividend(nftInP3)).to.equal(
      p3pvs / (p1Amt + p2Amt + p3Amt)
    );
  });

  it("Test claim with fee", async function () {
    //add p1pvs to pool[1]
    await xter.transfer(dd.address, p1pvs);
    // Speed up the clock to the second period
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      startTime + periodStartTime[1],
    ]);
    //period 2 begin
    await dd.updatePeriod(1);
    //add p2pvs to pool[2]
    await xter.transfer(dd.address, p2pvs);
    // Speed up the clock to the second period
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      startTime + periodStartTime[2],
    ]);
    //period 3 begin
    await dd.updatePeriod(2);
    await xter.transfer(dd.address, p3pvs);

    // Let u2 deploy the contract.
    let u2Contract = await hre.ethers.getContractAt(
      "BasicERC721",
      nftContractAddress
    );
    // Let u2 deploy the contract.
    await nftfactory
      .connect(u2)
      .deployBasicERC721("U2-contract", "U2T", "", BigInt(0));
    await gateway
      .connect(u2)
      .ERC721_mint(nftContractAddress, u2.address, u2nftId);
    expect(await u2Contract.ownerOf(u2nftId)).to.equal(u2.address);

    //claim one nft
    await expect(dd.connect(u1).claim([u2nftId])).to.be.revertedWith(
      "Dividend: you are not the owner of the nft"
    );

    const u2nftIdAmount = await dd.remainingDividend(u2nftId);
    expect(await dd.connect(u2).claim([u2nftId]))
      .to.emit(dd, "Claim")
      .withArgs(u2.address, u2nftId, u2nftIdAmount);
    expect(await dd.connect(u2).remainingDividend(u2nftId)).to.equal(0);
    // await expect(dd.connect(u2).claim([u2nftId])).to.be.revertedWith(
    //   "Dividend: your dividend amount is less than the service fee"
    // );
    // expect(await xter.balanceOf(feeRecipient.address)).to.equal(serviceFee);

    // claim Batch
    const u2nftId1 = 100,
      u2nftId2 = 6200,
      u2nftId3 = 12500;
    await gateway
      .connect(u2)
      .ERC721_mint(nftContractAddress, u2.address, u2nftId1);
    await gateway
      .connect(u2)
      .ERC721_mint(nftContractAddress, u2.address, u2nftId2);
    await gateway
      .connect(u2)
      .ERC721_mint(nftContractAddress, u2.address, u2nftId3);

    const u2nftIdAmount1 = await dd.remainingDividend(u2nftId1);
    const u2nftIdAmount2 = await dd.remainingDividend(u2nftId2);
    const u2nftIdAmount3 = await dd.remainingDividend(u2nftId3);
    // console.log(u2nftIdAmount1);
    // console.log(u2nftIdAmount2);
    // console.log(u2nftIdAmount3);

    const claimEvents = await dd
      .connect(u2)
      .claim([u2nftId1, u2nftId2, u2nftId3]);

    expect(claimEvents)
      .to.emit(dd, "Claim")
      .withArgs(u2.address, u2nftId1, u2nftIdAmount1);
    expect(claimEvents)
      .to.emit(dd, "Claim")
      .withArgs(u2.address, u2nftId2, u2nftIdAmount2);
    expect(claimEvents)
      .to.emit(dd, "Claim")
      .withArgs(u2.address, u2nftId3, u2nftIdAmount3);

    // expect(await xter.balanceOf(feeRecipient.address)).to.equal(2 * serviceFee);
  });
});
