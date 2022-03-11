const hre = require("hardhat");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");

const deployMajorToken = async (wallet) => {
  const Token = await hre.ethers.getContractFactory("PlayverseToken");
  const token = await Token.deploy(wallet);
  await token.deployed();
  return token;
};

const deployPresale = async (tokenAddr, price) => {
  const Presale = await hre.ethers.getContractFactory("Presale");
  const presale = await Presale.deploy(tokenAddr, price);
  await presale.deployed();
  return presale;
};

const deployVesting = async (
  managerAddr,
  tokenAddr,
  startTime,
  stages,
  unlockProportions
) => {
  const Vesting = await hre.ethers.getContractFactory(
    "Vesting"
  );
  vesting = await Vesting.deploy(
    managerAddr,
    tokenAddr,
    startTime,
    stages,
    unlockProportions
  );
  await vesting.deployed();
  return vesting;
};

const deployVote = async (ticketAddress, pvsAddress) => {
  const Vote = await hre.ethers.getContractFactory("Vote");
  const vote = await hre.upgrades.deployProxy(Vote, [
    ticketAddress,
    pvsAddress,
  ]);
  await vote.deployed();

  return vote;
};

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

  const gatewayImpl = await getImplementationAddress(
    hre.ethers.provider,
    gateway.address
  );
  const factoryImpl = await getImplementationAddress(
    hre.ethers.provider,
    factory.address
  );

  return { gateway, factory, gatewayImpl, factoryImpl };
};

const deployAutoDividend = async (pvsAddress, tokenAddress, periodStartTime) => {
  const Dividend = await hre.ethers.getContractFactory("AutoDividend");
  const dividend = await Dividend.deploy(pvsAddress, tokenAddress, periodStartTime);
  await dividend.deployed();
  return dividend;
}; 

const deployStaking = async (name, symbol, pvsAddress) => {
  const Staking = await hre.ethers.getContractFactory("StakingPVSContract");
  const staking = await hre.upgrades.deployProxy(Staking, [
    name,
    symbol,
    pvsAddress,
  ]);
  await staking.deployed();
  return staking;
};

module.exports = {
  deployMajorToken,
  deployPresale,
  deployVesting,
  deployNFTGatewayAndNFTFactory,
  deployStaking,
  deployVote,
  deployAutoDividend,
};
