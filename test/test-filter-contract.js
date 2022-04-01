const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const { deployMajorToken, deployFilter } = require("../lib/deploy.js");

describe("Test Filter Contract", function () {
  let filter, pvs;
  const pvsAmount = [10000, 100];

  beforeEach("init", async function () {
    // Reset test environment.
    await hre.network.provider.send("hardhat_reset");
    [owner, user0, user1] = await hre.ethers.getSigners();

    // Set up PVS contract
    pvs = await deployMajorToken(owner.address);
    await pvs.transfer(owner.address, pvsAmount[0]);

    // Set up filter contract
    
  });
  //
  it("should pass init test", async function () {
    // ToDo
  });
});
