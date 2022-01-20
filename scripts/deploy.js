const hre = require("hardhat");

const { deployNFTGatewayAndNFTFactory } = require('../lib/deploy.js');

const main = async () => {
  [admin] = await hre.ethers.getSigners();
  let { gateway, factory } = await deployNFTGatewayAndNFTFactory(admin);

  console.log(`Successfully deployed:`);
  console.log(`Gateway contract at address ${gateway.address}`);
  console.log(`Factory contract at address ${factory.address}`);
  console.log(`Gateway admin address: ${admin.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
