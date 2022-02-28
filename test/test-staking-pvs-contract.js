const { expect } = require("chai");
const hre = require("hardhat");
const { deployMajorToken, deployStaking } = require("../lib/deploy");

describe("Test Staking PVS..........", function () {
  let pvs, sk; // Contract objects
  const u1PVS = BigInt(1000000) * BigInt(10) ** BigInt(18);

  const oneHour = 60 * 60;
  const oneDay = 24 * oneHour;
  const sevenDays = 7 * oneDay;

  TEST_OVERRIDES_FOR_REVERT = {gasLimit: 100000};

  beforeEach("contracts deployed.", async function () {
    await hre.network.provider.send("hardhat_reset");

    [owner, u1, burner, minter, u2] = await hre.ethers.getSigners();
    pvs = await deployMajorToken(owner.address);
    sk = await deployStaking("Ticket", "TKT", pvs.address);
  });

  describe("Dealing with staker", function () {
    beforeEach("init", async function () {
      await pvs.transfer(u1.address, u1PVS);
    });

    it("init", async function () {
      expect(await sk.name()).to.equal("Ticket");
      expect(await sk.symbol()).to.equal("TKT");
      expect(await sk.decimals()).to.equal(18);
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
  });


  describe("Dealing with cross chain bridge", function () {
    beforeEach("init stake", async function () {
      //stake some pvs for one week
      await pvs.transfer(u1.address, u1PVS);
      const amtToStake = u1PVS;
      await pvs.connect(u1).approve(sk.address, amtToStake);
      await sk.connect(u1).stake(amtToStake);
      await ethers.provider.send('evm_increaseTime', [sevenDays]);
      await ethers.provider.send('evm_mine');
    });

    it("Test Minter & Burner", async function () {
      const u1TKTAmt = await sk.balanceOf(u1.address);
      const burnRole = await sk.TICKET_BURNER_ROLE();
      const mintRole = await sk.TICKET_MINTER_ROLE();

      //addBurner
      await sk.connect(owner).addBurner(burner.address);
      await expect(sk.connect(burner).burn(burner.address, 1)).to.be.revertedWith("Ticket balance is insufficient");

      //burn
      const burning = await sk.connect(burner).burn(u1.address, u1TKTAmt);
      expect(burning).to.emit(sk, "Transfer").withArgs(u1.address, "0x0000000000000000000000000000000000000000", u1TKTAmt);
      expect(burning).to.emit(sk, "TicketBurned").withArgs(u1.address, burner.address, u1TKTAmt);
      
      //removeBurner
      await sk.connect(owner).removeBurner(burner.address);
      // await expect(sk.connect(burner).burn(burner.address, 0, TEST_OVERRIDES_FOR_REVERT)).to.be.revertedWith(`'AccessControl: account ${burner.address} is missing role ${burnRole}'`);
      await expect(sk.connect(burner).burn(burner.address, 0)).to.be.reverted;


      //addMinter
      const mintAmt = BigInt(5) * BigInt(10) ** BigInt(18);
      await sk.connect(owner).addMinter(minter.address); 

      //mint
      const oldSupply = BigInt(await sk.totalSupply());
      const mint = await sk.connect(minter).mint(u1.address, mintAmt);
      expect(await sk.totalSupply()).to.equal((oldSupply + mintAmt));
      expect(mint).to.emit(sk, "Transfer").withArgs("0x0000000000000000000000000000000000000000", u1.address, mintAmt);
      expect(mint).to.emit(sk, "TicketMinted").withArgs(minter.address, u1.address, mintAmt);

      //remove Minter
      await sk.connect(owner).removeMinter(minter.address);
      // await expect(sk.connect(minter).mint(minter.address, mintAmt, TEST_OVERRIDES_FOR_REVERT)).to.be.revertedWith(`'AccessControl: account ${minter.address} is missing role ${mintRole}'`);
      await expect(sk.connect(minter).mint(minter.address, mintAmt)).to.be.reverted;
    });

    it("Test ERC20 override", async function () {
      const transAmt = BigInt(5) * BigInt(10) ** BigInt(18);
      await sk.connect(u1).transfer(u2.address, transAmt);
      expect(await sk.balanceOf(u2.address)).to.equal(0);

      await sk.connect(u1).approve(u2.address, transAmt);
      expect(await sk.allowance(u1.address, u2.address)).to.equal(0);

      await sk.transferFrom(u1.address, u2.address, transAmt);
      expect(await sk.balanceOf(u2.address)).to.equal(0);
    });

  });
});
