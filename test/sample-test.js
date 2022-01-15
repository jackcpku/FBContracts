const { expect } = require("chai");
const hre = require("hardhat");



describe("Test VestingContract", function () {
  let fbt, vc;                       // Contract objects
  let owner, u1, u2, u3, u4;         // Signers

  let ownerContractAddress;      // TODO ownerContractAddress should be a multisig wallet

  const startTime = 1700000000;
  const stages = [0, 100000];
  const unlockProportion = [0, 400];

  const totalAmount = BigInt(1000000);
  const proportions = [300, 700];

  beforeEach("Two contracts deployed.", async function () {
    // Reset test environment.
    await hre.network.provider.send("hardhat_reset");

    [owner, u1, u2, u3, u4] = await hre.ethers.getSigners();
    ownerContractAddress = owner.address;
    const FunBoxToken = await hre.ethers.getContractFactory("FunBoxToken");
    fbt = await FunBoxToken.deploy();
    await fbt.deployed();

    const fbtAddress = fbt.address;
    console.log(`FunBoxToken deployed at ${fbtAddress}`);
    const VestingContract = await hre.ethers.getContractFactory("VestingContract");
    vc = await VestingContract.deploy(
      ownerContractAddress,  // address _owner,
      fbt.address,  // address _tokenAddress,
      totalAmount,      // uint256 _totalAmount,
      [u1.address, u2.address],    // address[] memory _beneficiaries,
      proportions,  // uint256[] memory _proportions,
      startTime,  // uint256 _start,
      stages, // uint256[] memory _stages,
      unlockProportion     // uint256[] memory _unlockProportion
    )
    await vc.deployed();

    const vcAddress = vc.address;
    console.log(`VestingContract deployed at ${vcAddress}`);
  });

  it("VC Fields correctly initialized.", async function () {
    expect(await vc.beneficiaryProportion(u1.address)).to.equal(300);
    expect(await vc.beneficiaryProportion(u2.address)).to.equal(700);

    // console.log(await vc.startSecond())

    expect(await vc.startSecond()).to.equal(BigInt(1700000000));

    // console.log((await vc.stageSecond(0)));

    expect(await vc.stageSecond(0)).to.equal(0);
    expect(await vc.stageSecond(1)).to.equal(100000);
    expect(await vc.unlockProportion(0)).to.equal(0);
    expect(await vc.unlockProportion(1)).to.equal(400);
  });

  describe("Dealing with FBTs.", function () {
    beforeEach("Send 1000000 FBT to VestingContract.", async function () {
      expect(await fbt.balanceOf(owner.address)).to.equal(BigInt(10) ** BigInt(27));
      // console.log(await fbt.balanceOf(owner.address));
      await fbt.transfer(vc.address, totalAmount)
      // console.log(await fbt.balanceOf(owner.address));
      expect(await fbt.balanceOf(vc.address)).to.equal(totalAmount);
    });

    it("Test vest proportion schedule.", async function () {
      expect(await vc._vestingProportionSchedule(startTime - 3)).to.equal(0);
      expect(await vc._vestingProportionSchedule(startTime)).to.equal(400);
      expect(await vc._vestingProportionSchedule(startTime + 1000)).to.equal(400);
      expect(await vc._vestingProportionSchedule(startTime + stages[1])).to.equal(1000);
      expect(await vc._vestingProportionSchedule(startTime + 10000000)).to.equal(1000);
    });

    it("Test vest amount schedule.", async function () {
      expect(await vc._vestingAmountSchedule(u1.address, startTime - 3)).to.equal(0);
      expect(await vc._vestingAmountSchedule(u1.address, startTime)).to.equal(120000);
      expect(await vc._vestingAmountSchedule(u1.address, startTime + 1000)).to.equal(120000);
      expect(await vc._vestingAmountSchedule(u1.address, startTime + stages[1])).to.equal(300000);
      expect(await vc._vestingAmountSchedule(u1.address, startTime + 10000000)).to.equal(300000);

      expect(await vc._vestingAmountSchedule(u2.address, startTime - 3)).to.equal(0);
      expect(await vc._vestingAmountSchedule(u2.address, startTime)).to.equal(280000);
      expect(await vc._vestingAmountSchedule(u2.address, startTime + 1000)).to.equal(280000);
      expect(await vc._vestingAmountSchedule(u2.address, startTime + stages[1])).to.equal(700000);
      expect(await vc._vestingAmountSchedule(u2.address, startTime + 10000000)).to.equal(700000);
    });

    it("Test release function.", async function () {
      const block = await hre.ethers.provider.getBlock("latest");
      // Deployment should be earlier than startTime.
      expect(block.timestamp < startTime);

      // Before startTime, no one should be able to receive tokens.
      await expect(vc.connect(u1).release()).to.be.revertedWith("Tokens not available.");

      // Speed up the clock.
      await hre.network.provider.send("evm_setNextBlockTimestamp", [startTime + stages[0]]);

      // Let u1 pull his part from vc.
      await vc.connect(u1).release();
      expect(await vc.released(u1.address)).to.equal(120000);
      expect(await vc.released(u2.address)).to.equal(0);

      // u1 should have some FBT in his wallet now.
      expect(await fbt.balanceOf(u1.address)).to.equal(120000);

      // After pulling once, u1 should not be able to pull again.
      await expect(vc.connect(u1).release()).to.be.revertedWith("Tokens not available.");

      // Speed up the clock to the second stage when all funds are available.
      await hre.network.provider.send("evm_setNextBlockTimestamp", [startTime + stages[1]]);

      // Let u1 pull again.
      await vc.connect(u1).release();

      expect(await fbt.balanceOf(u1.address)).to.equal(300000);

      // Let u2 pull all funds at once.
      await vc.connect(u2).release();

      expect(await fbt.balanceOf(u2.address)).to.equal(700000);

      // No one should be able to pull after.
      await expect(vc.connect(u1).release()).to.be.revertedWith("Tokens not available.");
      await expect(vc.connect(u2).release()).to.be.revertedWith("Tokens not available.");
    });

    it("Test changeBeneficiary.", async function () {
      const block = await hre.ethers.provider.getBlock("latest");
      // Deployment should be earlier than startTime.
      expect(block.timestamp < startTime);

      // Before startTime, no one should be able to receive tokens.
      await expect(vc.connect(u1).release()).to.be.revertedWith("Tokens not available.");

      // Speed up the clock.
      await hre.network.provider.send("evm_setNextBlockTimestamp", [startTime + stages[0]]);

      // Let u1 pull his part from vc.
      await vc.connect(u1).release();
      expect(await vc.released(u1.address)).to.equal(120000);
      expect(await vc.released(u2.address)).to.equal(0);

      // u1 should have some FBT in his wallet now.
      expect(await fbt.balanceOf(u1.address)).to.equal(120000);

      // u1 changes beneficiary to u3.
      await vc.connect(u1).changeBeneficiary(u1.address, u3.address);

      // After transfering to u3, u1 will not be able to pull.
      await expect(vc.connect(u1).release()).to.be.revertedWith("Only beneficiaries receive.");
      // u3 also has no more tokens to pull.
      await expect(vc.connect(u3).release()).to.be.revertedWith("Tokens not available.");

      // Owner replaces u2 with u4.
      await vc.changeBeneficiary(u2.address, u4.address);

      // Speed up the clock to the second stage when all funds are available.
      await hre.network.provider.send("evm_setNextBlockTimestamp", [startTime + stages[1]]);

      // Let u1 pull and fail.
      await expect(vc.connect(u1).release()).to.be.revertedWith("Only beneficiaries receive.");
      // Let u3 pull and succeed.
      await vc.connect(u3).release();

      expect(await fbt.balanceOf(u1.address)).to.equal(120000);
      expect(await fbt.balanceOf(u3.address)).to.equal(180000);

      // Let u2 pull and fail.
      await expect(vc.connect(u2).release()).to.be.revertedWith("Only beneficiaries receive.");
      // Let u4 pull and succeed.
      await vc.connect(u4).release();

      expect(await fbt.balanceOf(u4.address)).to.equal(700000);

      // No one should be able to pull after.
      await expect(vc.connect(owner).release()).to.be.revertedWith("Only beneficiaries receive.");
      await expect(vc.connect(u1).release()).to.be.revertedWith("Only beneficiaries receive.");
      await expect(vc.connect(u2).release()).to.be.revertedWith("Only beneficiaries receive.");
      await expect(vc.connect(u3).release()).to.be.revertedWith("Tokens not available.");
      await expect(vc.connect(u4).release()).to.be.revertedWith("Tokens not available.");
    });
  });
});
