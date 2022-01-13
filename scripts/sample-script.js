// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

// async function main() {
//   // Hardhat always runs the compile task when running scripts with its command
//   // line interface.
//   //
//   // If this script is run directly using `node` you may want to call compile
//   // manually to make sure everything is compiled
//   // await hre.run('compile');

//   // We get the contract to deploy
//   const Greeter = await hre.ethers.getContractFactory("Greeter");
//   const greeter = await Greeter.deploy("Hello, Hardhat!");

//   await greeter.deployed();

//   console.log("Greeter deployed to:", greeter.address);
// }

const main = async () => {
  console.log("Hello, world!");
  const [owner, u1, u2] = await hre.ethers.getSigners();

  const FunBoxToken = await hre.ethers.getContractFactory("FunBoxToken");
  const fbt = await FunBoxToken.deploy();
  await fbt.deployed();

  const fbtAddress = fbt.address;
  console.log(`fbt is deployed at ${fbtAddress}`);
  const VestingContract = await hre.ethers.getContractFactory("VestingContract");
  const vestingContract = await VestingContract.deploy(
    fbt.address,  // address tokenAddress
    100000,      // uint256 totalAmount
    [u1.address, u2.address],    // address[] memory beneficiaries
    [300, 700],  // uint256[] memory proportions
    1500000000,  // uint256 start
    [0, 100000], // uint256[] memory stages
    [0, 400]     // uint256[] memory unlock_proportion
  )
  await vestingContract.deployed();

  const vcAddress = vestingContract.address;
  console.log(`vc is deployed at ${vcAddress}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
