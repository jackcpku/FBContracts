const hre = require("hardhat");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core")

const deployMajorToken = async (wallet) => {
  const Token = await hre.ethers.getContractFactory("FunBoxToken");
  const token = await Token.deploy(wallet);
  await token.deployed();
  return token;
}

const deployPresale = async (tokenAddr, price) => {
  const Presale = await hre.ethers.getContractFactory("PresaleContract");
  const presale = await Presale.deploy(tokenAddr, price);
  await presale.deployed();
  return presale;
}

const deployVesting = async (managerAddr, tokenAddr, beneficiaries, proportions, startTime, stages, unlockProportions) => {
  const VestingContract = await hre.ethers.getContractFactory("VestingContract");
  vesting = await VestingContract.deploy(
    managerAddr,
    tokenAddr,
    beneficiaries,
    proportions, 
    startTime, 
    stages, 
    unlockProportions 
  )
  await vesting.deployed();
  return vesting;
}

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
  deployMajorToken,
  deployPresale,
  deployVesting,
  deployNFTGatewayAndNFTFactory
};
