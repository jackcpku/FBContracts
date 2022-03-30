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

const deployElection = async (ticketAddress, pvsAddress) => {
  const NFTElection = await hre.ethers.getContractFactory("NFTElection");
  const vote = await hre.upgrades.deployProxy(NFTElection, [
    ticketAddress,
    pvsAddress,
  ]);
  await vote.deployed();

  return vote;
};

const deployNFTGatewayAndNFTFactory = async (gatewayAdmin) => {
  let gateway, factory;

  // Deploy NFTGateway contract.
  const Gateway = await hre.ethers.getContractFactory("NFTGateway");
  gateway = await hre.upgrades.deployProxy(Gateway, [gatewayAdmin.address]);
  await gateway.deployed();

  // Deploy NFTFactory contract using gateway address.
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

const deployPVSTicket = async (pvsAddress) => {
  const Ticket = await hre.ethers.getContractFactory("PVSTicket");
  const ticket = await hre.upgrades.deployProxy(Ticket, [
    pvsAddress,
  ]);
  await ticket.deployed();
  return ticket;
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

const deploySimpleLootBoxRegistry = async (
  gatewayAddress
) => {
  const LootBox = await hre.ethers.getContractFactory("SimpleLootBoxRegistry");
  const lootBox = await LootBox.deploy(gatewayAddress);
  await lootBox.deployed();
  return lootBox;
}

module.exports = {
  deployMajorToken,
  deployPresale,
  deployVesting,
  deployNFTGatewayAndNFTFactory,
  deployPVSTicket,
  deployElection,
  deployDividend,
  deployPPNLocker,
  deploySimpleLootBoxRegistry,
};
