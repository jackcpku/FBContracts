const hre = require("hardhat");

const main = async () => {
    await hre.run("verify:verify", {
        address: "0x16F741FA1e93F7E88742dCfF69c35954AB131b2F",
        constructorArguments: [
            "https://api.playvrs.net/nft/meta/",
            "0x0aE3e213e7aa970D78ebfE7155A12cD25DE3bDfA"
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
