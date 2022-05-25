const hre = require("hardhat");
const { upgradeContract } = require("../lib/upgrades");

async function main() {
    const instance = await upgradeContract("TokenGateway", hre.addrs.tokenGateway);

    console.log("TokenGateway upgraded: ", instance.address);
    return instance
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });