const hre = require("hardhat");
const { upgradeContract } = require("../lib/upgrades");

async function main() {
    const instance = await upgradeContract("NFTFactory", hre.addrs.nftFactory);

    console.log("NFTFactory upgraded: ", instance.address);
    return instance
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });