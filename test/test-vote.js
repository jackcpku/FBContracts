const { expect } = require("chai");
const hre = require("hardhat");
const { deployNFTGatewayAndNFTFactory } = require("../lib/deploy.js");
const { calculateCreate2AddressBasicERC721 } = require("../lib/create2.js");

const {
  deployElection,
  deployMajorToken,
  deployPVSTicket,
} = require("../lib/deploy.js");

describe("Test NFTElection Contract", function () {
  let gateway, factory;
  let vote, ticket, pvs, someERC721Contract;
  let owner, manager0, user0, user1;

  const pvsAmount = [100, 100];
  const tktAmount = [100000, 100000];
  const fallbackPrice = 40;
  const specialPrice = 80;
  const specialTokenId = 1;
  const normalTokenId = 2;

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
    ticket = await deployPVSTicket(pvs.address);
    const minterRole = await ticket.TICKET_MINTER_ROLE();
    await ticket.grantRole(minterRole, owner.address);
    await ticket.mint(user0.address, tktAmount[0]);
    await ticket.mint(user1.address, tktAmount[1]);

    // Set up ERC721 contract
    ({ gateway, factory } = await deployNFTGatewayAndNFTFactory(owner));
    const from = factory.address;
    const deployeeName = "BasicERC721";
    const tokenName = "SomeERC721";
    const tokenSymbol = "SNFT";
    const baseURI = "baseURI";
    const salt = 233;
    const someNFTAddress = await calculateCreate2AddressBasicERC721(
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
      .deployBasicERC721(tokenName, tokenSymbol, baseURI, salt);
    someERC721Contract = await hre.ethers.getContractAt(
      "BasicERC721",
      someNFTAddress
    );
    await gateway
      .connect(manager0)
      .ERC721_mint(someNFTAddress, manager0.address, normalTokenId);
    await gateway
      .connect(manager0)
      .ERC721_mint(someNFTAddress, manager0.address, specialTokenId);

    // Set up NFTElection contract
    vote = await deployElection(ticket.address, pvs.address);
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
    expect(
      await vote.getPrice(someERC721Contract.address, normalTokenId)
    ).to.equal(fallbackPrice);
  });

  it("should get special price", async function () {
    expect(
      await vote.getPrice(someERC721Contract.address, specialTokenId)
    ).to.equal(specialPrice);
  });

  it("should fail initializing vote if not manager", async function () {
    await expect(
      vote.initializeVote(
        someERC721Contract.address,
        currentTimestamp - 1,
        deadlineTimestamp
      )
    ).to.be.revertedWith("NFTElection: not manager");
  });

  it("should pass integration test", async function () {
    /****************** Before Listing Time ******************/
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      currentTimestamp - 100,
    ]);

    // Manager initializes vote and fails
    await expect(
      vote
        .connect(manager0)
        .initializeVote(
          someERC721Contract.address,
          deadlineTimestamp + 1,
          deadlineTimestamp
        )
    ).to.be.revertedWith("NFTElection: invalid listingTime or expirationTime");

    // Manager initializes vote
    await vote
      .connect(manager0)
      .initializeVote(
        someERC721Contract.address,
        currentTimestamp - 1,
        deadlineTimestamp
      );

    // Manager initializes vote again and fails
    await expect(
      vote
        .connect(manager0)
        .initializeVote(
          someERC721Contract.address,
          currentTimestamp - 1,
          deadlineTimestamp + 1
        )
    ).to.be.revertedWith("NFTElection: vote can be initialized only once");

    // No one is able to vote before listing time
    await expect(
      vote.connect(user0).vote(someERC721Contract.address, specialTokenId, 10)
    ).to.be.revertedWith("NFTElection: the voting process has not started");

    /****************** After Listing Time ******************/
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      currentTimestamp,
    ]);

    // No one is able to vote before the nft is transferred to vote contract
    await expect(
      vote.connect(user0).vote(someERC721Contract.address, specialTokenId, 10)
    ).to.be.revertedWith("NFTElection: nft not owned by contract");

    // Transfer the nfts to vote contract
    await someERC721Contract
      .connect(manager0)
      .transferFrom(manager0.address, vote.address, specialTokenId);
    await someERC721Contract
      .connect(manager0)
      .transferFrom(manager0.address, vote.address, normalTokenId);

    // user0 votes 0 and fails
    await expect(
      vote.connect(user0).vote(someERC721Contract.address, specialTokenId, 10)
    ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    // user0 approves vote of spending pvs
    await pvs.connect(user0).approve(vote.address, 80);
    // user0 votes 0 and succeeds
    await vote
      .connect(user0)
      .vote(someERC721Contract.address, specialTokenId, 10);
    // user1 votes less or equal than user0 and fails
    await pvs.connect(user1).approve(vote.address, 80);
    await expect(
      vote.connect(user1).vote(someERC721Contract.address, specialTokenId, 10)
    ).to.be.revertedWith("NFTElection: please vote more");
    // user1 votes more than user0 and succeeds
    await vote
      .connect(user1)
      .vote(someERC721Contract.address, specialTokenId, 20);
    // user0 votes even more
    await vote
      .connect(user0)
      .vote(someERC721Contract.address, specialTokenId, 100);
    // user1 votes more than he has and fails
    await expect(
      vote
        .connect(user1)
        .vote(someERC721Contract.address, specialTokenId, tktAmount[1])
    ).to.be.revertedWith("Ticket balance is insufficient");
    // user0 votes more when he is already the winner
    await vote
      .connect(user0)
      .vote(someERC721Contract.address, specialTokenId, 1);
    await vote
      .connect(user0)
      .vote(someERC721Contract.address, specialTokenId, 1);
    // user0 withdraws margin and fails
    await expect(vote.connect(user0).withdrawMargin(80)).to.be.revertedWith(
      "NFTElection: low margin balance"
    );
    // user1 withdraws margin and succeeds
    await vote.connect(user1).withdrawMargin(80);
    // user0 claims with invalid input
    await expect(
      vote
        .connect(user0)
        .claim([someERC721Contract.address], [specialTokenId, specialTokenId])
    ).to.be.revertedWith("NFTElection: invalid input");
    // user0 claims before ddl and fails
    await expect(
      vote.connect(user0).claim([someERC721Contract.address], [specialTokenId])
    ).to.be.revertedWith("NFTElection: the voting process has not finished");

    // manager claims no-winner token before ddl and fails
    await expect(
      vote
        .connect(manager0)
        .claimBack(someERC721Contract.address, [normalTokenId])
    ).to.be.revertedWith("NFTElection: the voting process has not finished");

    /****************** After Expiration Time ******************/
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      deadlineTimestamp,
    ]);
    // user0 votes after ddl and fails
    await expect(
      vote.connect(user0).vote(someERC721Contract.address, specialTokenId, 1)
    ).to.be.revertedWith("NFTElection: the voting process has been finished");
    // user0 claims after the ddl and succeeds
    await vote
      .connect(user0)
      .claim([someERC721Contract.address], [specialTokenId]);

    // manager claims no-winner token
    await vote
      .connect(manager0)
      .claimBack(someERC721Contract.address, [normalTokenId]);

    // manager claims non-no-winner token and fails
    await expect(
      vote
        .connect(manager0)
        .claimBack(someERC721Contract.address, [specialTokenId])
    ).to.be.revertedWith("NFTElection: the token has a winner");
  });
});
