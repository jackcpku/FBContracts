const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const {
  deployVote,
  deployMajorToken,
  deployStaking,
} = require("../lib/deploy.js");

describe("Test Vote Contract", function () {
  let vote, ticket, pvs;
  let owner;

  beforeEach("Deploy Vote Contract", async function () {
    // Reset test environment.
    await hre.network.provider.send("hardhat_reset");

    [owner] = await hre.ethers.getSigners();

    // Deploy PVS contract
    pvs = await deployMajorToken(owner.address);

    // Deploy Staking contract
    ticket = await deployStaking("Ticket", "TKT", pvs.address);

    vote = await deployVote();
  });
});
