const hre = require("hardhat");
const prompt = require("prompt");

const { deploySimpleLootBoxRegistry } = require('../lib/deploy');

const main = async () => {
    console.info("Network: " + hre.network.name);
    console.info("Deploy lootbox with NFTGateway: " + hre.addrs.nftGateway);
    const { confirm } = await prompt.get([{ name: "confirm", description: "Confirm? (y/N)" }]);
    if (confirm === 'y' || confirm === 'Y') {
        lootbox = await deploySimpleLootBoxRegistry(hre.addrs.nftGateway);
        console.info("SimpleLootBoxRegistry Deployed: " + lootbox.address);
    } else {
        console.error("Not confirmed, abort!");
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
