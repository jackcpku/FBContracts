const { expect } = require("chai");
const hre = require("hardhat");
const { deployMajorToken, deployNFTGatewayAndNFTFactory, deployDividend } = require("../lib/deploy");

describe("Test NFT Dividend..........", function () {
  let pvs, dd, gateway, factory; 
 
  const p1pvs = BigInt(10000);
  const p2pvs = BigInt(30000);
  const p3pvs = BigInt(35000);

  const p1Amt = BigInt(2000);
  const p2Amt = BigInt(1000);
  const p3Amt = BigInt(500);

  const u2nftId = 222;

  let nftContractAddress;

  beforeEach("contracts deployed.", async function () {
    await hre.network.provider.send("hardhat_reset");

    [owner, gatewayAdmin, u1, u2, u3, u4] = await hre.ethers.getSigners();
    pvs = await deployMajorToken(owner.address);

    //deploy nft factory
    ({ gateway, factory } = await deployNFTGatewayAndNFTFactory(gatewayAdmin));
    // Similate the call to obtain the return value.
    nftContractAddress = await factory
      .connect(u2)
      .callStatic.deployBaseERC721("U2-contract", "U2T");

    dd = await deployDividend(pvs.address, nftContractAddress, p1Amt);
  });

  it("Test Period 1 :", async function() {
    expect (await dd.maxTokenId(1)).to.equal(p1Amt);
    expect (await dd.totalDividend(1)).to.equal(0);
    await expect(dd.totalDividend(2001)).to.be.revertedWith("Dividend: tokenId exceeded limit");
    //add p1pvs to pool[1]
    await pvs.transfer(dd.address, p1pvs);
    expect (await dd.totalDividend(1)).to.equal(p1pvs / p1Amt);
  });

  it("Test Period 2 :", async function() {
    //add p1pvs to pool[1]
    await pvs.transfer(dd.address, p1pvs);
    await expect(dd.connect(u1.address).updatePeriod(2, p2Amt)).to.be.reverted;
    // period 2 begin
    await dd.updatePeriod(2, p2Amt);
    await expect(dd.updatePeriod(1, p2Amt)).to.be.revertedWith("Dividend: the new period must be exactly one period after the present");
    //add p2pvs to pool[2]
    await pvs.transfer(dd.address, p2pvs);
    expect (await dd.totalDividend(1))
      .to.equal(p1pvs / p1Amt + (p2pvs) / (p1Amt + p2Amt));

    expect (await dd.totalDividend(2001))
      .to.equal(((p2pvs) / (p1Amt + p2Amt)));
  });

  it("Test Period 3 :", async function() {
    //add p1pvs to pool[1]
    await pvs.transfer(dd.address, p1pvs);
    //period 2 begin
    await dd.updatePeriod(2, p2Amt);
    //add p2pvs to pool[2]
    await pvs.transfer(dd.address, p2pvs);
    //period 3 begin
    await dd.updatePeriod(3, p3Amt);
    await pvs.transfer(dd.address, p3pvs);

    expect (await dd.totalDividend(1))
      .to.equal(p1pvs / p1Amt + (p2pvs / (p1Amt + p2Amt)) + (p3pvs / (p1Amt + p2Amt + p3Amt)));
    
    expect (await dd.totalDividend(2002))
      .to.equal(p2pvs / (p1Amt + p2Amt) + (p3pvs / (p1Amt + p2Amt + p3Amt)));
    
    expect (await dd.totalDividend(3333))
      .to.equal(p3pvs / (p1Amt + p2Amt + p3Amt));
  });

  it("Test claim", async function() {
    //add p1pvs to pool[1]
    await pvs.transfer(dd.address, p1pvs);
    //period 2 begin
    await dd.updatePeriod(2, p2Amt);
    //add p2pvs to pool[2]
    await pvs.transfer(dd.address, p2pvs);
    //period 3 begin
    await dd.updatePeriod(3, p3Amt);
    await pvs.transfer(dd.address, p3pvs);

    // Let u2 deploy the contract.
    let u2Contract = await hre.ethers.getContractAt(
      "ERC721Base",
      nftContractAddress
    );
    // Let u2 deploy the contract.
    await factory.connect(u2).deployBaseERC721("U2-contract", "U2T");
    await gateway.connect(u2).ERC721_mint(nftContractAddress, u2.address, u2nftId);
    expect(await u2Contract.ownerOf(u2nftId)).to.equal(u2.address);

    //claim
    await expect(dd.connect(u1).claim(u2nftId)).to.be.revertedWith("Dividend: Can't claim dividend because you are not the owner of the nft");
    expect(await dd.connect(u2).claim(u2nftId)).to.emit(dd, "Claim").withArgs(u2.address, u2nftId, await dd.totalDividend(u2nftId));
    expect (await dd.connect(u2).remainDividend(u2nftId)).to.equal(0);

    //claim Batch
    const u2nftId1 = 100, u2nftId2 = 2200, u2nftId3 = 3500;
    await gateway.connect(u2).ERC721_mint(nftContractAddress, u2.address, u2nftId1);
    await gateway.connect(u2).ERC721_mint(nftContractAddress, u2.address, u2nftId2);
    await gateway.connect(u2).ERC721_mint(nftContractAddress, u2.address, u2nftId3);
    const claimBatchEvent = await dd.connect(u2).claimBatch([u2nftId1, u2nftId2, u2nftId3]);
    expect(claimBatchEvent).to.emit(dd, "Claim").withArgs(u2.address, u2nftId1, await dd.totalDividend(u2nftId1));
    expect(claimBatchEvent).to.emit(dd, "Claim").withArgs(u2.address, u2nftId2, await dd.totalDividend(u2nftId2));
    expect(claimBatchEvent).to.emit(dd, "Claim").withArgs(u2.address, u2nftId3, await dd.totalDividend(u2nftId3));
  });
});
