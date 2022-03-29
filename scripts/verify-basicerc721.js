const hre = require("hardhat");
const { multisigWalletAddr } = require('./params');

const main = async () => {
    await hre.run("verify:verify", {
        address: "0x0c23Ff838A1206b6a040B9bFD2Be277D9fb1baC7",
        constructorArguments: [
            "ERC721NFT",
            "ENFT",
            "https://api.playvrs.net/nft/meta/",
            "0x0aE3e213e7aa970D78ebfE7155A12cD25DE3bDfA"
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
