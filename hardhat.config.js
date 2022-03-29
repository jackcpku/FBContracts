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
  let vesting = "";
  let presale = "";
  switch (hre.network.name) {
    case "rinkeby":
      // token = "0x73Cc24A49DF675206E61dDb3f57BAA80C4844664";
      token = "0x68944779E69686467189fE3e20b0751158103053";       //hzr's pvs
      presale = "0x0B4174812EBDD920B75237F376521057a2b23991";
      vesting = "0xcac23BF1ebD991356930da8762a411a9F233933f";
      nftGateway = "0x0aE3e213e7aa970D78ebfE7155A12cD25DE3bDfA";
      break;
    case "mainnet":
      // TODO:
      token = "";
      presale = "";
      vesting = "";
      nftGateway = "";
      break;
  }
  hre.addrs = {
    token, vesting, presale, nftGateway
  }
  hre.contracts = {
    token: token == "" ? null : hre.ethers.getContractAt("PlayverseToken", token),
    vesting: vesting == "" ? null : hre.ethers.getContractAt("Vesting", vesting),
    presale: presale == "" ? null : hre.ethers.getContractAt("Presale", presale),
    nftGateway: nftGateway == "" ? null : hre.ethers.getContractAt("NFTGateway", nftGateway),
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