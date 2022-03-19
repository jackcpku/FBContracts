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
  const vesting = await Vesting.deploy(
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
  let gateway, factory, libDeployBasicERC721, libDeployBasicERC1155;

  // First deploy the necessary libraries for NFTFactory.
  const DeployBasicERC721 = await hre.ethers.getContractFactory(
    "DeployBasicERC721"
  );
  libDeployBasicERC721 = await DeployBasicERC721.deploy();

  const DeployBasicERC1155 = await hre.ethers.getContractFactory(
    "DeployBasicERC1155"
  );
  libDeployBasicERC1155 = await DeployBasicERC1155.deploy();

  // Deploy NFTGateway contract.
  const GateWay = await hre.ethers.getContractFactory("NFTGateway");
  gateway = await hre.upgrades.deployProxy(GateWay, [gatewayAdmin.address]);
  await gateway.deployed();

  // Deploy NFTFactory contract using gateway address.
  const NFTFactory = await hre.ethers.getContractFactory("NFTFactory", {
    libraries: {
      DeployBasicERC721: libDeployBasicERC721.address,
      DeployBasicERC1155: libDeployBasicERC1155.address,
    },
  });
  factory = await hre.upgrades.deployProxy(NFTFactory, [gateway.address], {
    unsafeAllowLinkedLibraries: true,
  });
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

const deployDividend = async (pvsAddress, tokenAddress, periodStartTime) => {
  const Dividend = await hre.ethers.getContractFactory("Dividend");
  const dividend = await Dividend.deploy(
    pvsAddress,
    tokenAddress,
    periodStartTime
  );
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

const deployPPNLocker = async (
  manager,
  ppnAddress,
  periodStartTime,
  unlockQuantity
) => {
  const PPNLocker = await hre.ethers.getContractFactory("PPNLocker");
  const ppnLocker = await PPNLocker.deploy(
    manager,
    ppnAddress,
    periodStartTime,
    unlockQuantity
  );
  await ppnLocker.deployed();
  return ppnLocker;
};

module.exports = {
  deployMajorToken,
  deployPresale,
  deployVesting,
  deployNFTGatewayAndNFTFactory,
  deployStaking,
  deployVote,
  deployDividend,
  deployPPNLocker,
};
