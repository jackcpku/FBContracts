const hre = require("hardhat");

const { deployGatewayAndFactories } = require("../lib/deploy.js");

const main = async () => {
  [admin] = await hre.ethers.getSigners();
  let { gateway, nftfactory, gatewayImpl, factoryImpl } =
    await deployGatewayAndFactories(admin);

  console.log(`Gateway admin address: ${admin.address}`);
  console.log(`Successfully deployed:`);
  console.log(`Gateway contract proxy at address ${gateway.address}`);
  console.log(`Factory contract proxy at address ${nftfactory.address}`);
  console.log(`Gateway contract implementation at address ${gatewayImpl}`);
  console.log(`Factory contract implementation at address ${nftfactoryImpl}`);
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
