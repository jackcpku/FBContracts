const hre = require("hardhat");
const { vestingManagerAddr, vestingBeneficiaries, vestingProportions, vestingStart, vestingStages, vestingStageProportions } = require('./params');

const main = async () => {
    const manager = vestingManagerAddr();
    const beneficiaries = vestingBeneficiaries();
    const proportions = vestingProportions();
    const start = vestingStart();
    const stages = vestingStages();
    const stageProportions = vestingStageProportions();
    await hre.run("verify:verify", {
        address: hre.addrs.vesting,
        constructorArguments: [
            manager, hre.addrs.token, beneficiaries, proportions, start, stages, stageProportions
        ],
    });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
