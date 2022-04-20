const hre = require("hardhat");

/*********** token **************/

const multisigWalletAddr = () => {
    switch (hre.network.name) {
        case "rinkeby":
            return "0x69c6549f5BF0Aaa1fb99DFcf8e21E5B9c90C3436";
        case "mainnet":
            // TODO: Mainnet Multisig Wallet
            return "";
    }
}

/*********** presale **************/

const presalePrice = () => {
    return 100;
}

const presaleAllowedStableCoins = () => {
    switch (hre.network.name) {
        case "rinkeby":
            return ["0x4081e38991E123E3d42Ad0E3cFBC948C7cc468F1", "0xe04c9B291d0cc56B764FC02E7422c8cd2d235856"];
        case "mainnet":
            // TODO
            return [];
    }
}

/*********** dividend **************/

const dividendPeriodStartTimes = (now) => {
    const startTimes = (days) => days.map(d => d * 24 * 60 * 60 + now);
    switch (hre.network.name) {
        case "rinkeby":
            return startTimes([0, 1, 1, 3, 7, 10, 30, 90]);
        case "mainnet":
            // TODO
            return [];
    }
}

/*********** filter ***************/

const filterAlpha = () => {
    switch (hre.network.name) {
        case "rinkeby":
            return 300;
        case "mainnet":
            // TODO
            return 0;
    }
}

/*********** splitter *************/

const splitterAddresses = (filterAddress) => {
    switch (hre.network.name) {
        case "rinkeby":
            // [burnAddress, platformAddress, filterAddress]
            return ["0x000000000000000000000000000000000000dEaD", "0xB239DE6DF4967511f5cb1938E44cfc9968d5c9D7", filterAddress];
        case "mainnet":
            // TODO
            return ['', '', ''];
    }
}
const splitterProportions = () => {
    switch (hre.network.name) {
        case "rinkeby":
            return [5_000, 4_650, 350];
        case "mainnet":
            // TODO
            return [0, 0, 0];
    }
}

/*********** vesting **************/

const vestingManagerAddr = () => {
    // To be confirmed
    return multisigWalletAddr();
}

const vestingStart = () => {
    switch (hre.network.name) {
        case "rinkeby":
            return 1644580768;
        case "mainnet":
            // TODO
            return 1644580768;
    }
}

const vestingStages = () => {
    const daysToSecs = (days) => days.map(d => d * 24 * 60 * 60);
    switch (hre.network.name) {
        case "rinkeby":
            return daysToSecs([1, 7, 30, 90]);
        case "mainnet":
            // TODO
            return [];
    }
}

const vestingStageProportions = () => {
    switch (hre.network.name) {
        case "rinkeby":
            return [0, 1000, 2000, 5000];
        case "mainnet":
            // TODO
            return [];
    }
}

/********** marketplace **********/
const marketServiceFeeRecipient = () => {
    // To be confirmed
    switch (hre.network.name) {
        case "rinkeby":
            return multisigWalletAddr();
        case "mainnet":
            // TODO
            return "";
    }
}


/*********** export **************/

module.exports = {
    multisigWalletAddr,
    presalePrice,
    presaleAllowedStableCoins,
    vestingManagerAddr,
    vestingStart,
    vestingStages,
    vestingStageProportions,
    marketServiceFeeRecipient,
    dividendPeriodStartTimes,
    filterAlpha,
    splitterAddresses,
    splitterProportions
}