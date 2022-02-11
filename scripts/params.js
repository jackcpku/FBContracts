const hre = require("hardhat");

const multisigWalletAddr = () => {
    switch (hre.network.name) {
        case "rinkeby":
            return "0xf0F8c924480e514fAe98f1834B84CC5A363EFa10";
        case "mainnet":
            // TODO: Mainnet Multisig Wallet
            return "";
    }
}

const presalePrice = () => {
    return 100;
}

const presaleAllowedStableCoins = () => {
    switch (hre.network.name) {
        case "rinkeby":
            return ["0x4b43903c586e9aa28fc49eef26146646716b051d"];
        case "mainnet":
            // TODO
            return [];
            break;
    }
}

module.exports = {
    multisigWalletAddr,
    presalePrice,
    presaleAllowedStableCoins
}