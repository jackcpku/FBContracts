const { expect } = require("chai");
const hre = require("hardhat");
const { deployMajorToken, deployStaking } = require("../lib/deploy");

describe("Test Staking PVS..........", function () {
  let pvs, tkt, sk; // Contract objects
  const u1PVS = BigInt(1000000) * BigInt(10) ** BigInt(18);

  const oneHour = 60 * 60;
  const oneDay = 24 * oneHour;
  const sevenDays = 7 * oneDay;

  beforeEach("contracts deployed.", async function () {
    await hre.network.provider.send("hardhat_reset");

    [owner, u1, u2, u3, u4] = await hre.ethers.getSigners();
    pvs = await deployMajorToken(owner.address);
    sk = await deployStaking("Ticket", "TKT", pvs.address);
  });

  describe("Dealing with..........", function () {
    beforeEach("init", async function () {
      await pvs.transfer(u1.address, u1PVS);
    });

    it("init", async function () {
      expect(await sk.name()).to.equal("Ticket");
      expect(await sk.symbol()).to.equal("TKT");
      expect(await sk.balanceOf(owner.address)).to.equal(0);
      expect(await sk.totalSupply()).to.equal(0);
    });

    it("Test u1 stake & withdraw", async function() {
      const amtToStake = u1PVS / BigInt(2);
      await pvs.connect(u1).approve(sk.address, amtToStake);
      await sk.connect(u1).stake(amtToStake);

      expect(await sk.pvsAmount(u1.address)).to.equal(amtToStake);
      const blockBefore = await ethers.provider.getBlock("latest");

      //after one hour
      await ethers.provider.send('evm_increaseTime', [oneHour]);
      await ethers.provider.send('evm_mine');
      expect(await sk.balanceOf(u1.address)).to.equal(BigInt(await sk.calculateIncrement(u1.address)));
      
      //after one day
      await ethers.provider.send('evm_increaseTime', [oneDay]);
      await ethers.provider.send('evm_mine');
      expect(await sk.balanceOf(u1.address)).to.equal(BigInt(await sk.calculateIncrement(u1.address)));

      //after seven days
      await ethers.provider.send('evm_increaseTime', [sevenDays]);
      await ethers.provider.send('evm_mine');
      expect(await sk.balanceOf(u1.address)).to.equal(BigInt(await sk.calculateIncrement(u1.address)));

      //withdraw Half
      await sk.connect(u1).withdraw(amtToStake / BigInt(2));
      const balanceAfterWithdrawHalf = await sk.balanceOf(u1.address);

      //after seven days
      await ethers.provider.send('evm_increaseTime', [sevenDays]);
      await ethers.provider.send('evm_mine');
      expect(await sk.balanceOf(u1.address)).to.equal((BigInt(balanceAfterWithdrawHalf) + BigInt(await sk.calculateIncrement(u1.address))));

      //withdraw all
      await sk.connect(u1).withdraw(amtToStake / BigInt(2));
      const balanceAfterWithdrawAll = await sk.balanceOf(u1.address);

      //after seven days
      await ethers.provider.send('evm_increaseTime', [sevenDays]);
      await ethers.provider.send('evm_mine');
      expect(await sk.balanceOf(u1.address)).to.equal(balanceAfterWithdrawAll);
    });

    // it("Test", async function () {

    // });
  });
});
