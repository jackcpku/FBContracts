const hre = require("hardhat");
const { upgradeContract } = require("../lib/upgrades");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");

async function main() {
    const instance = await upgradeContract("NFTFactory", hre.addrs.nftFactory);

    const implAddr = await getImplementationAddress(
        hre.ethers.provider,
        instance.address
    );

    console.log("NFTFactory upgraded: ", instance.address, "impl addr: ", implAddr);
    return instance
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });