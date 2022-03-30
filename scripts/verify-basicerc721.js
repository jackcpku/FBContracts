const hre = require("hardhat");
const { multisigWalletAddr } = require('./params');

const main = async () => {
    await hre.run("verify:verify", {
        address: "0x82B44024F68BcDA197CF8D58aed88eDAD3d393C4",
        constructorArguments: [
            "NFT721",
            "N721",
            "https://api.playvrs.net/nft/meta/rinkeby/",
            "0x197560a2CB04721079225529aFbc53D65759a13C"
        ],
        contract: "contracts/nft/BasicERC721.sol:BasicERC721"
    });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
