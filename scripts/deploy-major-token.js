const hre = require("hardhat");
const prompt = require("prompt");

const { deployMajorToken } = require('../lib/deploy.js');

const main = async () => {
    let multisigWallet;
    switch (hre.network.name) {
        case "rinkeby":
            multisigWallet = "0xf0F8c924480e514fAe98f1834B84CC5A363EFa10";
            break;
        case "mainnet":
            // TODO: Mainnet Multisig Wallet
            multisigWallet = "";
            break;
    }
    console.info("Network: " + hre.network.name);
    console.info("Deploy token with init wallet: " + multisigWallet);
    const { confirm } = await prompt.get([{ name: "confirm", description: "Confirm? (y/N)" }]);
    if (confirm === 'y' || confirm === 'Y') {
        majorToken = await deployMajorToken(multisigWallet);
        console.info("Token Deployed: " + majorToken.address);
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
