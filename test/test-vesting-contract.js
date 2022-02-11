const { expect } = require("chai");
const hre = require("hardhat");
const { deployMajorToken, deployVesting } = require("../lib/deploy")

describe("Test VestingContract", function () {
  let fbt, vc;                               // Contract objects
  let owner, owner2, u1, u2, u3, u4;         // Signers

  const startTime = 1700000000;
  const stages = [0, 100000];
  const unlockProportion = [0, 400];

  const totalAmount = BigInt(1000000);
  const proportions = [300, 700];

  beforeEach("Two contracts deployed.", async function () {
    // Reset test environment.
    await hre.network.provider.send("hardhat_reset");

    [owner, owner2, u1, u2, u3, u4] = await hre.ethers.getSigners();

    fbt = await deployMajorToken(owner);

    vc = await deployVesting(
      owner.address,
      fbt.address,
      [u1.address, u2.address],
      proportions,
      startTime,
      stages,
      unlockProportion
    )

  });

  it("VC Fields correctly initialized.", async function () {
    expect(await vc.beneficiaryProportion(u1.address)).to.equal(300);
    expect(await vc.beneficiaryProportion(u2.address)).to.equal(700);

    expect(await vc.startSecond()).to.equal(BigInt(1700000000));

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
      expect(await vc.vestingProportionSchedule(startTime - 3)).to.equal(0);
      expect(await vc.vestingProportionSchedule(startTime)).to.equal(400);
      expect(await vc.vestingProportionSchedule(startTime + 1000)).to.equal(400);
      expect(await vc.vestingProportionSchedule(startTime + stages[1])).to.equal(1000);
      expect(await vc.vestingProportionSchedule(startTime + 10000000)).to.equal(1000);
    });

    it("Test vest amount schedule.", async function () {
      expect(await vc.vestingAmountSchedule(u1.address, startTime - 3)).to.equal(0);
      expect(await vc.vestingAmountSchedule(u1.address, startTime)).to.equal(120000);
      expect(await vc.vestingAmountSchedule(u1.address, startTime + 1000)).to.equal(120000);
      expect(await vc.vestingAmountSchedule(u1.address, startTime + stages[1])).to.equal(300000);
      expect(await vc.vestingAmountSchedule(u1.address, startTime + 10000000)).to.equal(300000);

      expect(await vc.vestingAmountSchedule(u2.address, startTime - 3)).to.equal(0);
      expect(await vc.vestingAmountSchedule(u2.address, startTime)).to.equal(280000);
      expect(await vc.vestingAmountSchedule(u2.address, startTime + 1000)).to.equal(280000);
      expect(await vc.vestingAmountSchedule(u2.address, startTime + stages[1])).to.equal(700000);
      expect(await vc.vestingAmountSchedule(u2.address, startTime + 10000000)).to.equal(700000);
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

    it("Test TokenReleased events", async function () {
      const block = await hre.ethers.provider.getBlock("latest");
      // Deployment should be earlier than startTime.
      expect(block.timestamp < startTime);

      // Speed up the clock.
      await hre.network.provider.send("evm_setNextBlockTimestamp", [startTime + stages[0]]);

      // Let u1 pull his part from vc.
      expect(await vc.connect(u1).release()).to.emit(vc, "TokenReleased").withArgs(u1.address, 120000);

      // Speed up the clock to the second stage when all funds are available.
      await hre.network.provider.send("evm_setNextBlockTimestamp", [startTime + stages[1]]);

      // Let u1 pull again.
      expect(await vc.connect(u1).release()).to.emit(vc, "TokenReleased").withArgs(u1.address, 180000);

      // Let u2 pull all funds at once.
      expect(await vc.connect(u2).release()).to.emit(vc, "TokenReleased").withArgs(u2.address, 700000);
    })

    it("Test change manager", async function () {
      const block = await hre.ethers.provider.getBlock("latest");
      // Deployment should be earlier than startTime.
      expect(block.timestamp < startTime);

      await hre.network.provider.send("evm_setNextBlockTimestamp", [startTime + stages[0]]);

      expect(await vc.transferManagement(owner2.address))
        .to.emit(vc, "ManagementTransferred").withArgs(owner.address, owner2.address);

      // After owner becomes ex-manager, he has no right to change any beneficiary.
      await expect(vc.changeBeneficiary(u1.address, u3.address)).to.be.revertedWith("Unauthorized request.");

      // While owner2 has the right to do so.
      expect(await vc.connect(owner2).changeBeneficiary(u1.address, u3.address))
        .to.emit(vc, "BeneficiaryChanged").withArgs(u1.address, u3.address, owner2.address);
    })

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

    it("Test BeneficiaryChanged events.", async function () {
      const block = await hre.ethers.provider.getBlock("latest");
      // Deployment should be earlier than startTime.
      expect(block.timestamp < startTime);

      // Speed up the clock.
      await hre.network.provider.send("evm_setNextBlockTimestamp", [startTime + stages[0]]);

      // Let u1 pull his part from vc.
      await vc.connect(u1).release();

      // u1 changes beneficiary to u3.
      expect(await vc.connect(u1).changeBeneficiary(u1.address, u3.address))
        .to.emit(vc, "BeneficiaryChanged").withArgs(u1.address, u3.address, u1.address);

      // Owner replaces u2 with u4.
      expect(await vc.changeBeneficiary(u2.address, u4.address))
        .to.emit(vc, "BeneficiaryChanged").withArgs(u2.address, u4.address, owner.address);
    });
  });
});
