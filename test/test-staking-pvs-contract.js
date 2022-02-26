const { expect } = require("chai");
const hre = require("hardhat");
const { deployMajorToken, deployStaking } = require("../lib/deploy")

describe("Test Staking PVS..........", function () {
    let pvs, tkt, sk;                               // Contract objects
    const u1PVS = BigInt(1000000) * BigInt(10) ** BigInt(18);

    beforeEach("contracts deployed.", async function () {
        await hre.network.provider.send("hardhat_reset");

        [owner, u1, u2, u3, u4] = await hre.ethers.getSigners();
        pvs = await deployMajorToken(owner.address);
        sk = await deployStaking();
        await sk.initialize("Ticket", "TKT", pvs.address);

    });

    describe("Dealing with..........", function () {
        beforeEach("init", async function () {
            await pvs.transfer(u1.address, u1PVS);
        });

        it("init", async function () {
            expect(await sk.name()).to.equal("Ticket");
            expect(await sk.symbol()).to.equal("TKT");
            expect(await sk.balanceOf(owner.address)).to.equal(0);
        });

        it("Test stake", async function () {
            await pvs.connect(u1).approve(sk.address, BigInt(10000));

            await sk.connect(u1).stake(BigInt(100));
            // console.log(await sk.calculateIncrement(u1.address));

            const block = await hre.ethers.provider.getBlock("latest");

            // console.log(block.number);
            // console.log(block.timestamp);

            // const tktbalabce = await sk.connect(u1).updateCheckpoint(u1.address);
            // console.log(tktbalabce);
        });

        // it("Test", async function () {
            
        // });
    });
});
