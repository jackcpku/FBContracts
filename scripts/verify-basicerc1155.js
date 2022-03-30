const hre = require("hardhat");

const main = async () => {
    await hre.run("verify:verify", {
        address: "0xbb198Bdb33D9D582a16C13c9e1E1406e497B6Ac9",
        constructorArguments: [
            "https://api.playvrs.net/nft/meta/rinkeby/",
            "0x197560a2CB04721079225529aFbc53D65759a13C"
        ],
        contract: "contracts/nft/BasicERC1155.sol:BasicERC1155"
    });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
