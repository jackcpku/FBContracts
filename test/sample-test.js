const { expect } = require("chai");
const hre = require("hardhat");



describe("VestingContract", () => {
  let fbt, vestingContract;  // Contract handlers
  let owner, u1, u2;         // Signers

  before("Deploy contracts", async () => {
    [owner, u1, u2] = await hre.ethers.getSigners();
    const FunBoxToken = await hre.ethers.getContractFactory("FunBoxToken");
    fbt = await FunBoxToken.deploy();
    await fbt.deployed();

    const fbtAddress = fbt.address;
    console.log(`FunBoxToken deployed at ${fbtAddress}`);
    const VestingContract = await hre.ethers.getContractFactory("VestingContract");
    vestingContract = await VestingContract.deploy(
      fbt.address,  // address _tokenAddress,
      100000,      // uint256 _totalAmount,
      [u1.address, u2.address],    // address[] memory _beneficiaries,
      [300, 700],  // uint256[] memory _proportions,
      1700000000,  // uint256 _start,
      [0, 100000], // uint256[] memory _stages,
      [0, 400]     // uint256[] memory _unlockProportion
    )
    await vestingContract.deployed();

    const vcAddress = vestingContract.address;
    console.log(`VestingContract deployed at ${vcAddress}`);
  });

  it("Fields correctly set", async () => {
    expect(await vestingContract.beneficiaryProportion(u1.address)).to.equal(300);
    expect(await vestingContract.beneficiaryProportion(u2.address)).to.equal(700);

    // console.log(await vestingContract.startSecond())

    expect(await vestingContract.startSecond()).to.equal(BigInt(1700000000));

    // console.log((await vestingContract.stageSecond(0)));

    expect(await vestingContract.stageSecond(0)).to.equal(0);
    expect(await vestingContract.stageSecond(1)).to.equal(100000);
    expect(await vestingContract.unlockProportion(0)).to.equal(0);
    expect(await vestingContract.unlockProportion(1)).to.equal(400);
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
