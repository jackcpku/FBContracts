const hre = require("hardhat");

module.exports.upgradeContract = async function(name, address, ...args) {
    // We get the contract to deploy
    const Contract = await hre.ethers.getContractFactory(name);
    const instance = await hre.upgrades.upgradeProxy(address, Contract, args);

    await instance.deployed();
    return instance;
}