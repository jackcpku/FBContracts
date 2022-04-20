const hre = require("hardhat");
const prompt = require("prompt");

const { deployDividend, deploySplitter, deployFilter } = require("../lib/deploy");
const { dividendPeriodStartTimes, filterAlpha, splitterAddresses, splitterProportions } = require("./params");

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
    
    filter = await deployFilter(
        hre.addrs.token,
        dividend.address,
        filterAlpha()
    )
    console.info("Filter Contract Deployed: " + filter.address);

    splitter = await deploySplitter(
        hre.addrs.token,       
        splitterAddresses(filter.address),
        splitterProportions()
    )
    console.info("Splitter Contract Deployed: " + splitter.address);
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
