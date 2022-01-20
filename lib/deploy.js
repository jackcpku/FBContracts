const hre = require("hardhat");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core")

const deployNFTGatewayAndNFTFactory = async (gatewayAdmin) => {
  let gateway, factory;

  // First deploy NFTGateway contract.
  const GateWay = await hre.ethers.getContractFactory("NFTGateway");
  gateway = await hre.upgrades.deployProxy(GateWay, [gatewayAdmin.address]);
  await gateway.deployed();

  // Then deploy NFTFactory contract using gateway address.
  const NFTFactory = await hre.ethers.getContractFactory("NFTFactory");
  factory = await hre.upgrades.deployProxy(NFTFactory, [gateway.address]);
  await factory.deployed();

  // Register factory address in the gateway contract.
  await gateway.connect(gatewayAdmin).addManager(factory.address);

  const gatewayImpl = await getImplementationAddress(hre.ethers.provider, gateway.address);
  const factoryImpl = await getImplementationAddress(hre.ethers.provider, factory.address);

  return { gateway, factory, gatewayImpl, factoryImpl };
}


module.exports = {
  deployNFTGatewayAndNFTFactory
};
