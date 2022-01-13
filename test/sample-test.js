const { expect } = require("chai");
const hre = require("hardhat");



describe("Test VestingContract", function () {
  let fbt, vc;  // Contract handlers
  let owner, u1, u2;         // Signers

  const startTime = BigInt(1700000000);
  const stages = [BigInt(0), BigInt(100000)];
  const unlockProportion = [0, 400];

  const totalAmount = BigInt(1000000);
  const proportions = [300, 700];

  beforeEach("Two contracts deployed.", async function () {
    [owner, u1, u2] = await hre.ethers.getSigners();
    const FunBoxToken = await hre.ethers.getContractFactory("FunBoxToken");
    fbt = await FunBoxToken.deploy();
    await fbt.deployed();

    const fbtAddress = fbt.address;
    console.log(`FunBoxToken deployed at ${fbtAddress}`);
    const VestingContract = await hre.ethers.getContractFactory("VestingContract");
    vc = await VestingContract.deploy(
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
      expect(await vc.tokenBalance()).to.equal(totalAmount);
    });

    it("Test vest proportion schedule.", async function () {
      expect(await vc._vestingProportionSchedule(startTime - BigInt(3))).to.equal(0);
      expect(await vc._vestingProportionSchedule(startTime)).to.equal(400);
      expect(await vc._vestingProportionSchedule(startTime + BigInt(1000))).to.equal(400);
      expect(await vc._vestingProportionSchedule(startTime + stages[1])).to.equal(1000);
      expect(await vc._vestingProportionSchedule(startTime + BigInt(10000000))).to.equal(1000);
    });

    it("Test vest amount schedule.", async function () {
      expect(await vc._vestingAmountSchedule(u1.address, startTime - BigInt(3))).to.equal(0);
      expect(await vc._vestingAmountSchedule(u1.address, startTime)).to.equal(120000);
      expect(await vc._vestingAmountSchedule(u1.address, startTime + BigInt(1000))).to.equal(120000);
      expect(await vc._vestingAmountSchedule(u1.address, startTime + stages[1])).to.equal(300000);
      expect(await vc._vestingAmountSchedule(u1.address, startTime + BigInt(10000000))).to.equal(300000);

      expect(await vc._vestingAmountSchedule(u2.address, startTime - BigInt(3))).to.equal(0);
      expect(await vc._vestingAmountSchedule(u2.address, startTime)).to.equal(280000);
      expect(await vc._vestingAmountSchedule(u2.address, startTime + BigInt(1000))).to.equal(280000);
      expect(await vc._vestingAmountSchedule(u2.address, startTime + stages[1])).to.equal(700000);
      expect(await vc._vestingAmountSchedule(u2.address, startTime + BigInt(10000000))).to.equal(700000);
    });

    it("Test release function.", async function () {
      // TODO
    });
  });

  // it("Should return the new greeting once it's changed", async function () {
  //   const Greeter = await hre.ethers.getContractFactory("Greeter");
  //   const greeter = await Greeter.deploy("Hello, world!");
  //   await greeter.deployed();

  //   expect(await greeter.greet()).to.equal("Hello, world!");

  //   const setGreetingTx = await greeter.setGreeting("Hola, mundo!");

  //   // wait until the transaction is mined
  //   await setGreetingTx.wait();

  //   expect(await greeter.greet()).to.equal("Hola, mundo!");
  // });
});
