const hre = require("hardhat");
const prompt = require("prompt");

const { deployMarketplace } = require('../lib/deploy');
const { marketServiceFeeRecipient } = require('./params');

const main = async () => {
    const recipient = marketServiceFeeRecipient();
    console.info("Network: " + hre.network.name);
    console.info("Allowed Payment Token: " + hre.addrs.token);
    console.info("Service Fee Recipient: " + recipient);
    const { confirm } = await prompt.get([{ name: "confirm", description: "Confirm? (y/N)" }]);
    if (confirm === 'y' || confirm === 'Y') {
        const [marketplace, marketplaceImpl] = await deployMarketplace(hre.addrs.token, recipient);
        console.info("Marketplace Contract Proxy: " + marketplace.address);
        console.info("Marketplace Contract Implementation: " + marketplaceImpl);
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
