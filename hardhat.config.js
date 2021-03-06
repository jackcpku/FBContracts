require("@nomiclabs/hardhat-waffle");
require('@nomiclabs/hardhat-ethers');
require("@nomiclabs/hardhat-etherscan");
require('@openzeppelin/hardhat-upgrades');  // For upgradeable contracts
require('hardhat-abi-exporter');
require('dotenv').config();

// Test coverage
require('solidity-coverage');

const fs = require("fs")
const { ethers } = require("ethers");
const { extendEnvironment } = require("hardhat/config");

let privateKey = "";
if (process.env.ACCOUNT_PRIVATE_KEY) {
  privateKey = process.env.ACCOUNT_PRIVATE_KEY;
} else if (process.env.WALLET_PASSWORD) {
  const json = fs.readFileSync("wallet.json", { encoding: 'utf8', flag: 'r' });
  const wallet = ethers.Wallet.fromEncryptedJsonSync(json, process.env.WALLET_PASSWORD);
  privateKey = wallet.privateKey;
}

// // This is a sample Hardhat task. To learn how to create your own go to
// // https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

extendEnvironment((hre) => {
  let token = "";
  let presale = "";
  let vesting = "";
  let tokenGateway = "";
  let nftFactory = "";
  let erc20Factory = "";
  let simpleLootBoxRegistry = "";
  let marketplace = "";
  let xpn = "";
  let dividend = "";
  let filter = "";
  let splitter = "";
  switch (hre.network.name) {
    case "rinkeby":
      // token = "0x73Cc24A49DF675206E61dDb3f57BAA80C4844664";
      token = "0x68944779E69686467189fE3e20b0751158103053";       //hzr's xter
      presale = "0x5e317Bb79918C3451150E7cabf0706937952Fd52";
      vesting = "0xcac23BF1ebD991356930da8762a411a9F233933f";
      tokenGateway = "0x197560a2CB04721079225529aFbc53D65759a13C";
      nftFactory = "0x1808f367439774c7840a67d1Dfd3f159Ad0F3681";
      erc20Factory = "0x10794E1E76E8dFF39217a4d126BEeb76e47666Bf";
      simpleLootBoxRegistry = "0xE97480B8efBCCdB7ec6D8C81987541E493E4843A";
      marketplace = "0x328bA41a29550AdD31C26c3dc9B8604ab048f5E8";
      xpn = "0x97746889eF539182f5c2FbAb41D7099ba7ca4385";
      dividend = "0x8e5E59f05D6Ddf98C43623E94EDC124335b23c5c";
      filter = "0xEb7355b12Dc48997aDD48639191664BC898E0373";
      splitter = "0xA824622Cf8C069842d0468484eB0d29d0e149726";
      break;
    case "mainnet":
      // TODO:
      token = "";
      presale = "";
      vesting = "";
      tokenGateway = "";
      nftFactory = "";
      erc20Factory = "";
      simpleLootBoxRegistry = "";
      marketplace = "";
      xpn = "";
      dividend = "";
      filter = "";
      splitter = "";
      break;
  }
  hre.addrs = {
    token, vesting, presale, tokenGateway, nftFactory, erc20Factory, simpleLootBoxRegistry, marketplace, xpn, dividend, filter, splitter
  }
  hre.contracts = {
    token: token == "" ? null : hre.ethers.getContractAt("XterToken", token),
    vesting: vesting == "" ? null : hre.ethers.getContractAt("Vesting", vesting),
    presale: presale == "" ? null : hre.ethers.getContractAt("Presale", presale),
    tokenGateway: tokenGateway == "" ? null : hre.ethers.getContractAt("TokenGateway", tokenGateway),
    nftFactory: nftFactory == "" ? null : hre.ethers.getContractAt("NFTFactory", nftFactory),
    erc20Factory: erc20Factory == "" ? null : hre.ethers.getContractAt("ERC20Factory", erc20Factory),
    simpleLootBoxRegistry: simpleLootBoxRegistry == "" ? null : hre.ethers.getContractAt("SimpleLootBoxRegistry", simpleLootBoxRegistry),
    marketplace: marketplace == "" ? null : hre.ethers.getContractAt("Marketplace", marketplace),
    dividend: dividend == "" ? null : hre.ethers.getContractAt("Dividend", dividend),
    filter: filter == "" ? null : hre.ethers.getContractAt("Filter", filter),
    splitter: splitter == "" ? null : hre.ethers.getContractAt("Splitter", splitter),
  }
})

//////////////////////////////////////////////////////

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/" + process.env.API_KEY_INFURA_RINKEBY,
      // url: "https://eth-rinkeby.alchemyapi.io/v2/" + process.env.API_KEY_ALCHEMY_RINKEBY,
      accounts: privateKey != "" ? [privateKey] : []
    },
    // mainnet: {
    // }
  },
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 20000
  },
  etherscan: {
    apiKey: {
      rinkeby: process.env.API_KEY_ETHERSCAN_RINKEBY
    }
  },
  abiExporter: [
    {
      path: './abi/pretty',
      pretty: true,
      runOnCompile: true,
      clear: true,
      flat: true,
    },
    {
      path: './abi/ugly',
      pretty: false,
      runOnCompile: true,
      clear: true,
      flat: true,
    },
  ]
}