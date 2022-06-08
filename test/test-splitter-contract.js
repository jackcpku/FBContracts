const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const { deployMajorToken, deploySplitter } = require("../lib/deploy.js");

describe("Test Splitter Contract", function () {
  let splitter, xter;
  // const pvsAmount = [10000, 10_000_000];

  const pvsAmount = 10_000_000;
  const PROPORTION_DENOMINATOR = 10_000;
  const burnAddress = "0x000000000000000000000000000000000000dEaD";
  const platformAddress = "0xcd3B766CCDd6AE721141F452C550Ca635964ce71";
  const dividendAddress = "0xCD3b766CcDd6AE721141F452C550Ca635964CE72";
  const splitAddresses = [burnAddress, platformAddress, dividendAddress];
  const splitProportiones = [5_000, 4_650, 350];
  const newSplitProportiones = [350, 5_000, 4_650];

  beforeEach("init", async function () {
    // Reset test environment.
    await hre.network.provider.send("hardhat_reset");
    [owner, user0, user1] = await hre.ethers.getSigners();

    // Set up XTER contract
    xter = await deployMajorToken(owner.address);

    // Set up splitter contract
    await expect(
      deploySplitter(xter.address, [], splitProportiones)
    ).to.be.revertedWith(
      "Splitter: address length must equal to proportion length"
    );
    splitter = await deploySplitter(
      xter.address,
      splitAddresses,
      splitProportiones
    );

    await xter.connect(owner).transfer(splitter.address, pvsAmount);
  });

  it("should pass output & reset test", async function () {
    const outputEvent = await splitter.output();

    // console.log(await xter.balanceOf(splitAddresses[0]));
    // console.log(await xter.balanceOf(splitAddresses[1]));
    // console.log(await xter.balanceOf(splitAddresses[2]));

    expect(await xter.balanceOf(splitAddresses[0])).to.equal(
      (pvsAmount * splitProportiones[0]) / PROPORTION_DENOMINATOR
    );
    expect(await xter.balanceOf(splitAddresses[1])).to.equal(
      (pvsAmount * splitProportiones[1]) / PROPORTION_DENOMINATOR
    );
    expect(await xter.balanceOf(splitAddresses[2])).to.equal(
      (pvsAmount * splitProportiones[2]) / PROPORTION_DENOMINATOR
    );

    // msg.sender, amount, splitAddress, splitProportion
    expect(outputEvent)
      .to.emit(splitter, "Split")
      .withArgs(owner.address, pvsAmount, splitAddresses, splitProportiones);

    // reset
    await expect(splitter.reset(splitAddresses, [])).to.be.revertedWith(
      "Splitter: reset failed"
    );

    expect(await splitter.reset(splitAddresses, newSplitProportiones))
      .to.emit(splitter, "Reset")
      .withArgs(owner.address, splitAddresses, newSplitProportiones);
  });
});
