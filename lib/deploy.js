const hre = require("hardhat");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");

const deployMajorToken = async (wallet) => {
  const Token = await hre.ethers.getContractFactory("XterToken");
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
  const Vesting = await hre.ethers.getContractFactory("Vesting");
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

const deployGatewayAndFactories = async (gatewayAdmin) => {
  let gateway, nftfactory, erc20factory;

  // Deploy Gateway contract.
  const Gateway = await hre.ethers.getContractFactory("TokenGateway");
  gateway = await hre.upgrades.deployProxy(Gateway, [gatewayAdmin.address]);
  await gateway.deployed();

  // Deploy NFTFactory contract using gateway address.
  const NFTFactory = await hre.ethers.getContractFactory("NFTFactory");
  nftfactory = await hre.upgrades.deployProxy(NFTFactory, [gateway.address]);
  await nftfactory.deployed();

  // Deploy NFTFactory contract using gateway address.
  const ERC20Factory = await hre.ethers.getContractFactory("ERC20Factory");
  erc20factory = await hre.upgrades.deployProxy(ERC20Factory, [
    gateway.address,
  ]);
  await erc20factory.deployed();

  // Register factory address in the gateway contract.
  await gateway.connect(gatewayAdmin).addManager(nftfactory.address);
  await gateway.connect(gatewayAdmin).addManager(erc20factory.address);

  const gatewayImpl = await getImplementationAddress(
    hre.ethers.provider,
    gateway.address
  );
  const nftfactoryImpl = await getImplementationAddress(
    hre.ethers.provider,
    nftfactory.address
  );
  const erc20factoryImpl = await getImplementationAddress(
    hre.ethers.provider,
    erc20factory.address
  );

  return {
    gateway,
    nftfactory,
    erc20factory,
    gatewayImpl,
    nftfactoryImpl,
    erc20factoryImpl,
  };
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
  const ticket = await hre.upgrades.deployProxy(Ticket, [pvsAddress]);
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

const deploySimpleLootBoxRegistry = async (gatewayAddress) => {
  const LootBox = await hre.ethers.getContractFactory("SimpleLootBoxRegistry");
  const lootBox = await LootBox.deploy(gatewayAddress);
  await lootBox.deployed();
  return lootBox;
};

const deploySplitter = async (pvsAddress, splitAddress, splitProportion) => {
  const Splitter = await hre.ethers.getContractFactory("Splitter");
  const splitter = await Splitter.deploy(
    pvsAddress,
    splitAddress,
    splitProportion
  );
  await splitter.deployed();
  return splitter;
};

const deployFilter = async (pvsAddress, outputAddress, alpha) => {
  const Filter = await hre.ethers.getContractFactory("Filter");
  const filter = await Filter.deploy(pvsAddress, outputAddress, alpha);
  await filter.deployed();
  return filter;
};

const deployMarketplace = async (tokenAddr, serviceFeeRecipient) => {
  // Deploy the marketplace contract.
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const marketplace = await hre.upgrades.deployProxy(Marketplace, []);
  await marketplace.deployed();

  // Initialize the marketplace contract.
  await marketplace.addPaymentTokens([tokenAddr]);
  await marketplace.setServiceFeeRecipient(serviceFeeRecipient);

  const marketplaceImpl = await getImplementationAddress(
    hre.ethers.provider,
    marketplace.address
  );

  return [marketplace, marketplaceImpl];
};

const deployPVSTBridge = async (
  pvstAddress,
  wormholeAddress,
  verifierAddress
) => {
  const PVSTBridge = await hre.ethers.getContractFactory(
    "PVSTicketBridgeWormhole"
  );
  const pvstBridge = await PVSTBridge.deploy(
    pvstAddress,
    wormholeAddress,
    verifierAddress
  );
  await pvstBridge.deployed();
  return pvstBridge;
};

module.exports = {
  deployMajorToken,
  deployPresale,
  deployVesting,
  deployGatewayAndFactories,
  deployPVSTicket,
  deployElection,
  deployDividend,
  deployPPNLocker,
  deploySimpleLootBoxRegistry,
  deploySplitter,
  deployFilter,
  deployMarketplace,
  deployPVSTBridge,
};
