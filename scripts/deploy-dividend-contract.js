const hre = require("hardhat");
const prompt = require("prompt");

const { deployDividend } = require("../lib/deploy");
const { dividendPeriodStartTimes } = require("./params");

const main = async () => {
  console.info("Network: " + hre.network.name);
  console.info("Deploy dividend with pvs Address: " + hre.addrs.token);
  console.info("Deploy dividend with ppn Address: " + hre.addrs.ppn);
  const block = await hre.ethers.provider.getBlock("latest");
  const now = block.timestamp;
  console.info("startTime: ", now);
  const periodStartTimes = dividendPeriodStartTimes(now);
  console.info("periodStartTime: ", periodStartTimes);

  const { confirm } = await prompt.get([
    { name: "confirm", description: "Confirm? (y/N)" },
  ]);
  if (confirm === "y" || confirm === "Y") {
    dividend = await deployDividend(
      hre.addrs.token,
      hre.addrs.ppn,
      periodStartTimes
    );
    console.info("Dividend Contract Deployed: " + dividend.address);
  } else {
    console.error("Not confirmed, abort!");
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
