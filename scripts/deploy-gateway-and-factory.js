const hre = require("hardhat");

const { deployGatewayAndNFTFactories } = require("../lib/deploy.js");

const main = async () => {
  [admin] = await hre.ethers.getSigners();
  let {
    gateway,
    nftFactory,
    erc20Factory,
    gatewayImpl,
    nftFactoryImpl,
    erc20FactoryImpl,
  } = await deployGatewayAndNFTFactories(admin);

  console.log(`Gateway admin address: ${admin.address}`);
  console.log(`Successfully deployed:`);
  console.log(`Gateway contract proxy at address ${gateway.address}`);
  console.log(`NFTFactory contract proxy at address ${nftFactory.address}`);
  console.log(`ERC20Factory contract proxy at address ${erc20Factory.address}`);

  console.log(`Gateway contract implementation at address ${gatewayImpl}`);
  console.log(
    `NFTFactory contract implementation at address ${nftFactoryImpl}`
  );
  console.log(
    `ERC20Factory contract implementation at address ${erc20FactoryImpl}`
  );
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
