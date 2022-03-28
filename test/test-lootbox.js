const { expect } = require("chai");
const { BigNumber } = require("ethers");
const hre = require("hardhat");
const { deployLootBox } = require("../lib/deploy.js");

describe("Test LootBox Contract", function () {
  let lootBox;

  beforeEach("Deploy contract", async function () {
    // Reset test environment.
    await hre.network.provider.send("hardhat_reset");

    lootBox = await deployLootBox();
  });

  it.only("should get some random number between 1 and 2000", async function () {
    this.timeout(100000);

    let randoms = [];
    for (let i = 1; i <= 2000; i++) {
      if (i % 100 == 0) {
        console.log(`Done ${i} iterations`);
      }
      const tx = await lootBox.getRandom();
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
