const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const { deployMajorToken, deployFilter } = require("../lib/deploy.js");

describe("Test Filter Contract", function () {
  let filter, xter;
  const xterAmount = [10_000_000, 2_000];

  const ALPHA_DENOMINATOR = 10_000;
  const outputAddressOne = "0xcd3B766CCDd6AE721141F452C550Ca635964ce71";
  const outputAddressTwo = "0xCD3b766CcDd6AE721141F452C550Ca635964CE72";
  const alpha = 300;

  const oneHour = 60 * 60;
  const oneDay = 24 * oneHour;
  const sevenDays = 7 * oneDay;
  const times = [oneHour, oneDay, sevenDays];

  beforeEach("init", async function () {
    // Reset test environment.
    await hre.network.provider.send("hardhat_reset");
    [owner, user0, user1] = await hre.ethers.getSigners();

    // Set up XTER contract
    xter = await deployMajorToken(owner.address);

    // Set up filter contract
    filter = await deployFilter(xter.address, outputAddressOne, alpha);

    await xter.connect(owner).transfer(filter.address, xterAmount[0]);
    await filter.connect(owner).setOutputAddress(outputAddressTwo);
    await filter.connect(owner).setAlpha(alpha);
  });

  it("should pass filter test", async function () {
    const onceFilter = await filter.output();
    // operator, alpha, to, newIn, newOut, lastBalance;
    expect(onceFilter)
      .to.emit(filter, "FilterEmit")
      .withArgs(
        owner.address,
        alpha,
        outputAddressTwo,
        xterAmount[0],
        (alpha * xterAmount[0]) / ALPHA_DENOMINATOR,
        0
      );

    await expect(filter.output()).to.be.revertedWith(
      "Filter: at most once a day"
    );

    const block = await hre.ethers.provider.getBlock("latest");
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      block.timestamp + times[2],
    ]);

    const lastOut = (alpha * xterAmount[0]) / ALPHA_DENOMINATOR;
    const lastBalance = xterAmount[0] - lastOut;

    //second filter
    await xter.connect(owner).transfer(filter.address, xterAmount[1]);
    const secondFilter = await filter.output();

    // (alpha * newIn + (ALPHA_DENOMINATOR - alpha) * lastOut) / ALPHA_DENOMINATOR
    expect(secondFilter)
      .to.emit(filter, "FilterEmit")
      .withArgs(
        owner.address,
        alpha,
        outputAddressTwo,
        xterAmount[1],
        (alpha * xterAmount[1] + (ALPHA_DENOMINATOR - alpha) * lastOut) / ALPHA_DENOMINATOR,
        lastBalance
      );
  });
});
