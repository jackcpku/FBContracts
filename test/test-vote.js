const { expect } = require("chai");
const hre = require("hardhat");
const { deployGatewayAndFactories } = require("../lib/deploy.js");
const { calculateCreate2AddressBasicERC721 } = require("../lib/create2.js");

const {
  deployElection,
  deployMajorToken,
  deployXterTicket,
} = require("../lib/deploy.js");
const { BigNumber } = require("ethers");

const baseXTERTNum = BigNumber.from("1000000000000000000");

describe("Test NFTElection Contract", function () {
  let gateway, nftfactory;
  let vote, ticket, xter, someERC721Contract;
  let owner, manager0, user0, user1;

  const xterAmount = [100, 100];
  const tktAmount = [baseXTERTNum.mul(100000), baseXTERTNum.mul(100000)];
  const fallbackPrice = 40;
  const specialPrice = 80;
  const specialTokenId = 1;
  const normalTokenId = 2;

  const tokenIdLowerBound = 1;
  const tokenIdUpperBound = 100;

  const currentTimestamp = 9_000_000_000;
  const deadlineTimestamp = 10_000_000_000;

  beforeEach("Deploy contracts and set up balances", async function () {
    // Reset test environment.
    await hre.network.provider.send("hardhat_reset");

    [owner, manager0, user0, user1] = await hre.ethers.getSigners();

    // Set up XTER contract
    xter = await deployMajorToken(owner.address);
    await xter.transfer(user0.address, xterAmount[0]);
    await xter.transfer(user1.address, xterAmount[1]);

    // Set up Staking contract
    ticket = await deployXterTicket(xter.address);
    const minterRole = await ticket.TICKET_MINTER_ROLE();
    await ticket.grantRole(minterRole, owner.address);
    await ticket.mint(user0.address, tktAmount[0]);
    await ticket.mint(user1.address, tktAmount[1]);

    // Set up ERC721 contract
    ({ gateway, nftfactory } = await deployGatewayAndFactories(owner));
    const from = nftfactory.address;
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
    await nftfactory
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
    vote = await deployElection(ticket.address, xter.address);
    await vote.setServiceFeeRecipient(owner.address);
    await vote.setManager(someERC721Contract.address, manager0.address);

    // Complex dependencies
    const burnerRole = await ticket.TICKET_BURNER_ROLE();
    await ticket.grantRole(burnerRole, vote.address);
  });

  // it("should get fallback price", async function () {
  //   expect(
  //     await vote.getPrice(someERC721Contract.address, normalTokenId)
  //   ).to.equal(fallbackPrice);
  // });

  // it("should get special price", async function () {
  //   expect(
  //     await vote.getPrice(someERC721Contract.address, specialTokenId)
  //   ).to.equal(specialPrice);
  // });

  it("should fail initializing vote if not manager", async function () {
    await expect(
      vote
        .connect(user0)
        .initializeVote(
          someERC721Contract.address,
          tokenIdLowerBound,
          tokenIdUpperBound,
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
          tokenIdLowerBound,
          tokenIdUpperBound,
          deadlineTimestamp + 1,
          deadlineTimestamp
        )
    ).to.be.revertedWith("NFTElection: invalid listingTime or expirationTime");

    // Manager initializes vote
    const tx = await vote
      .connect(manager0)
      .initializeVote(
        someERC721Contract.address,
        tokenIdLowerBound,
        tokenIdUpperBound,
        currentTimestamp - 1,
        deadlineTimestamp
      );
    const rc = await tx.wait();
    const event = rc.events.find((event) => event.event === "InitializeVote");
    const electionId = BigNumber.from(event["topics"][2]);

    await vote
      .connect(manager0)
    ["setPrice(uint256,uint256)"](electionId, fallbackPrice);
    await vote
      .connect(manager0)
    ["setPrice(uint256,uint256,uint256)"](
      electionId,
      specialTokenId,
      specialPrice
    );

    // No one is able to vote before listing time
    await expect(
      vote.connect(user0).vote(electionId, specialTokenId, baseXTERTNum.mul(10))
    ).to.be.revertedWith("NFTElection: the voting process has not started");

    /****************** After Listing Time ******************/
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      currentTimestamp,
    ]);

    // No one is able to vote before the nft is transferred to vote contract
    await expect(
      vote.connect(user0).vote(electionId, specialTokenId, baseXTERTNum.mul(10))
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
      vote.connect(user0).vote(electionId, specialTokenId, baseXTERTNum.mul(10))
    ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    // user0 approves vote of spending xter
    await xter.connect(user0).approve(vote.address, baseXTERTNum.mul(80));
    // user0 votes 0 and succeeds
    await vote
      .connect(user0)
      .vote(electionId, specialTokenId, baseXTERTNum.mul(10));
    // user1 votes less or equal than user0 and fails
    await xter.connect(user1).approve(vote.address, baseXTERTNum.mul(80));
    await expect(
      vote.connect(user1).vote(electionId, specialTokenId, baseXTERTNum.mul(10))
    ).to.be.revertedWith("NFTElection: please vote more");
    // user1 votes more than user0 and succeeds
    await vote
      .connect(user1)
      .vote(electionId, specialTokenId, baseXTERTNum.mul(20));
    // user0 votes even more
    await vote
      .connect(user0)
      .vote(electionId, specialTokenId, baseXTERTNum.mul(100));
    // user1 votes more than he has and fails
    await expect(
      vote.connect(user1).vote(electionId, specialTokenId, tktAmount[1])
    ).to.be.revertedWith("Ticket balance is insufficient");
    // user0 votes more when he is already the winner
    await vote
      .connect(user0)
      .vote(electionId, specialTokenId, baseXTERTNum.mul(1));
    await vote
      .connect(user0)
      .vote(electionId, specialTokenId, baseXTERTNum.mul(1));
    // user0 withdraws margin and fails
    await expect(vote.connect(user0).withdrawMargin(80)).to.be.revertedWith(
      "NFTElection: low margin balance"
    );
    // user1 withdraws margin and succeeds
    await vote.connect(user1).withdrawMargin(80);
    // user0 claims with invalid input
    await expect(
      vote.connect(user0).claim([electionId], [specialTokenId, specialTokenId])
    ).to.be.revertedWith("NFTElection: invalid input");
    // user0 claims before ddl and fails
    await expect(
      vote.connect(user0).claim([electionId], [specialTokenId])
    ).to.be.revertedWith("NFTElection: the voting process has not finished");

    // manager claims no-winner token before ddl and fails
    await expect(
      vote.connect(manager0).claimBack(electionId, [normalTokenId])
    ).to.be.revertedWith("NFTElection: the voting process has not finished");

    /****************** After Expiration Time ******************/
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      deadlineTimestamp,
    ]);
    // user0 votes after ddl and fails
    await expect(
      vote.connect(user0).vote(electionId, specialTokenId, baseXTERTNum.mul(1))
    ).to.be.revertedWith("NFTElection: the voting process has been finished");
    // user0 claims after the ddl and succeeds
    await vote.connect(user0).claim([electionId], [specialTokenId]);

    // manager claims no-winner token
    await vote.connect(manager0).claimBack(electionId, [normalTokenId]);

    // manager claims non-no-winner token and fails
    await expect(
      vote.connect(manager0).claimBack(electionId, [specialTokenId])
    ).to.be.revertedWith("NFTElection: the token has a winner");
  });

  it("should pass ddl-extending test", async function () {
    /****************** Before Listing Time ******************/
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      currentTimestamp - 100,
    ]);

    // Manager initializes vote
    const tx = await vote
      .connect(manager0)
      .initializeVote(
        someERC721Contract.address,
        tokenIdLowerBound,
        tokenIdUpperBound,
        currentTimestamp - 1,
        deadlineTimestamp
      );
    const rc = await tx.wait();
    const event = rc.events.find((event) => event.event === "InitializeVote");
    const electionId = BigNumber.from(event["topics"][2]);

    // Transfer the nfts to vote contract
    await someERC721Contract
      .connect(manager0)
      .transferFrom(manager0.address, vote.address, specialTokenId);
    await someERC721Contract
      .connect(manager0)
      .transferFrom(manager0.address, vote.address, normalTokenId);

    /****************** After Listing Time ******************/
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      currentTimestamp,
    ]);

    // user0 approves vote of spending xter
    await xter.connect(user0).approve(vote.address, 80);
    // user1 approves vote of spending xter
    await xter.connect(user1).approve(vote.address, 80);

    for (let day = 0; day < 7; day++) {
      // An hour before the current ddl
      await hre.network.provider.send("evm_setNextBlockTimestamp", [
        deadlineTimestamp + day * 86400 - 3600,
      ]);

      // If the voter is the previous winner, the ddl will not
      // be extended. Hence change the voter each time.
      let user = day % 2 ? user0 : user1;

      expect(
        await vote
          .connect(user)
          .vote(electionId, specialTokenId, baseXTERTNum.mul(10 + day))
      )
        .to.emit(vote, "ExtendExpirationTime")
        .withArgs(electionId, someERC721Contract.address, specialTokenId);
    }

    // When the final ddl arrives
    await hre.network.provider.send("evm_setNextBlockTimestamp", [
      deadlineTimestamp + 7 * 86400,
    ]);

    // user0 votes 0 and fails
    await expect(
      vote
        .connect(user0)
        .vote(electionId, specialTokenId, baseXTERTNum.mul(10 + 7))
    ).to.be.revertedWith("NFTElection: the voting process has been finished");
  });

  it("should pass range test", async function () {
    await vote
      .connect(manager0)
      .initializeVote(
        someERC721Contract.address,
        tokenIdLowerBound,
        tokenIdUpperBound,
        currentTimestamp - 1,
        deadlineTimestamp
      );

    await expect(
      vote
        .connect(manager0)
        .initializeVote(
          someERC721Contract.address,
          tokenIdLowerBound,
          tokenIdUpperBound,
          currentTimestamp - 1,
          deadlineTimestamp
        )
    ).to.be.revertedWith(
      "NFTElection: invalid tokenIdBounds in initialization"
    );

    await expect(
      vote
        .connect(manager0)
        .initializeVote(
          someERC721Contract.address,
          (tokenIdLowerBound + tokenIdUpperBound + 1) / 2,
          (tokenIdLowerBound + tokenIdUpperBound + 1) / 2,
          currentTimestamp - 1,
          deadlineTimestamp
        )
    ).to.be.revertedWith(
      "NFTElection: invalid tokenIdBounds in initialization"
    );

    await expect(
      vote
        .connect(manager0)
        .initializeVote(
          someERC721Contract.address,
          1,
          10000,
          currentTimestamp - 1,
          deadlineTimestamp
        )
    ).to.be.revertedWith(
      "NFTElection: invalid tokenIdBounds in initialization"
    );

    await vote
      .connect(manager0)
      .initializeVote(
        someERC721Contract.address,
        tokenIdUpperBound + 1,
        tokenIdUpperBound + 1,
        currentTimestamp - 1,
        deadlineTimestamp
      );

    await vote
      .connect(manager0)
      .initializeVote(
        someERC721Contract.address,
        tokenIdUpperBound + 100,
        tokenIdUpperBound + 150,
        currentTimestamp - 1,
        deadlineTimestamp
      );

    await expect(
      vote
        .connect(manager0)
        .initializeVote(
          someERC721Contract.address,
          tokenIdUpperBound + 125,
          tokenIdUpperBound + 175,
          currentTimestamp - 1,
          deadlineTimestamp
        )
    ).to.be.revertedWith(
      "NFTElection: invalid tokenIdBounds in initialization"
    );
  });
});
