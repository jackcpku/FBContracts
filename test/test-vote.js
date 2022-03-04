const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const {
  deployVote,
  deployMajorToken,
  deployStaking,
} = require("../lib/deploy.js");

describe("Test Vote Contract", function () {
  let vote, ticket, pvs, someERC721Contract;
  let owner, manager0, user0, user1;

  const pvsAmount = [100, 100];
  const tktAmount = [100000, 100000];
  const fallbackPrice = 40;
  const specialPrice = 80;
  const specialTokenId = 0;

  const currentTimestamp = 9_000_000_000;
  const deadlineTimestamp = 10_000_000_000;

  beforeEach("Deploy contracts and set up balances", async function () {
    // Reset test environment.
    await hre.network.provider.send("hardhat_reset");

    [owner, manager0, user0, user1] = await hre.ethers.getSigners();

    // Set up PVS contract
    pvs = await deployMajorToken(owner.address);
    await pvs.transfer(user0.address, pvsAmount[0]);
    await pvs.transfer(user1.address, pvsAmount[1]);

    // Set up Staking contract
    ticket = await deployStaking("Ticket", "TKT", pvs.address);
    const minterRole = await ticket.TICKET_MINTER_ROLE();
    await ticket.grantRole(minterRole, owner.address);
    await ticket.mint(user0.address, tktAmount[0]);
    await ticket.mint(user1.address, tktAmount[1]);

    // Set up ERC721 contract
    let SomeERC721Contract = await hre.ethers.getContractFactory("SomeERC721");
    someERC721Contract = await SomeERC721Contract.connect(manager0).deploy(
      "Some NFT",
      "SNFT"
    );
    await someERC721Contract.deployed();
    await someERC721Contract.connect(manager0).mint(manager0.address, "uri-0");
    await someERC721Contract.connect(manager0).mint(manager0.address, "uri-1");

    // Set up Vote contract
    vote = await deployVote(ticket.address, pvs.address);
    await vote.setServiceFeeRecipient(owner.address);
    await vote.setManager(someERC721Contract.address, manager0.address);
    await vote
      .connect(manager0)
      ["setPrice(address,uint256)"](someERC721Contract.address, fallbackPrice);
    await vote
      .connect(manager0)
      ["setPrice(address,uint256,uint256)"](
        someERC721Contract.address,
        specialTokenId,
        specialPrice
      );

    // Complex dependencies
    const burnerRole = await ticket.TICKET_BURNER_ROLE();
    await ticket.grantRole(burnerRole, vote.address);
  });

  it("should get fallback price", async function () {
    expect(await vote.getPrice(someERC721Contract.address, 1)).to.equal(
      fallbackPrice
    );
  });

  it("should get special price", async function () {
    expect(await vote.getPrice(someERC721Contract.address, 0)).to.equal(
      specialPrice
    );
  });

  it("should fail initializing vote if not manager", async function () {
    await expect(
      vote.initializeVote(someERC721Contract.address, deadlineTimestamp)
    ).to.be.revertedWith("Vote: not manager");
  });

  it("should pass integration test", async function () {
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      currentTimestamp,
    ]);

    // Manager initializes vote
    await vote
      .connect(manager0)
      .initializeVote(someERC721Contract.address, deadlineTimestamp);

    // Manager initializes vote again and fails
    await expect(
      vote
        .connect(manager0)
        .initializeVote(someERC721Contract.address, deadlineTimestamp + 1)
    ).to.be.revertedWith("Vote: vote can be initialized only once");

    // No one is able to vote before the nft is transferred to vote contract
    await expect(
      vote.connect(user0).vote(someERC721Contract.address, 0, 10)
    ).to.be.revertedWith("Vote: nft not owned by contract");

    // Transfer the nft to vote contract
    await someERC721Contract
      .connect(manager0)
      .transferFrom(manager0.address, vote.address, 0);

    // user0 votes 0 and fails
    await expect(
      vote.connect(user0).vote(someERC721Contract.address, 0, 10)
    ).to.be.revertedWith("ERC20: insufficient allowance");
    // user0 approves vote of spending pvs
    await pvs.connect(user0).approve(vote.address, 80);
    // user0 votes 0 and succeeds
    await vote.connect(user0).vote(someERC721Contract.address, 0, 10);
    // user1 votes less or equal than user0 and fails
    await pvs.connect(user1).approve(vote.address, 80);
    await expect(
      vote.connect(user1).vote(someERC721Contract.address, 0, 10)
    ).to.be.revertedWith("Vote: please vote more");
    // user1 votes more than user0 and succeeds
    await vote.connect(user1).vote(someERC721Contract.address, 0, 20);
    // user0 votes even more
    await vote.connect(user0).vote(someERC721Contract.address, 0, 100);
    // user1 votes more than he has and fails
    await expect(
      vote.connect(user1).vote(someERC721Contract.address, 0, tktAmount[1])
    ).to.be.revertedWith("Ticket balance is insufficient");
    // user0 votes more when he is already the winner
    await vote.connect(user0).vote(someERC721Contract.address, 0, 1);
    await vote.connect(user0).vote(someERC721Contract.address, 0, 1);
    // user0 withdraws margin and fails
    await expect(vote.connect(user0).withdrawMargin(80)).to.be.revertedWith(
      "Vote: low margin balance"
    );
    // user1 withdraws margin and succeeds
    await vote.connect(user1).withdrawMargin(80);
    // user0 claims with invalid input
    await expect(
      vote.connect(user0).claim([someERC721Contract.address], [0, 0])
    ).to.be.revertedWith("Vote: invalid input");
    // user0 claims before ddl and fails
    await expect(
      vote.connect(user0).claim([someERC721Contract.address], [0])
    ).to.be.revertedWith("Vote: The voting process has not finished");

    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      deadlineTimestamp,
    ]);
    // user0 votes after ddl and fails
    await expect(
      vote.connect(user0).vote(someERC721Contract.address, 0, 1)
    ).to.be.revertedWith("Vote: the voting process has been finished");
    // user0 claims after the ddl and succeeds
    await vote.connect(user0).claim([someERC721Contract.address], [0]);
  });
});
