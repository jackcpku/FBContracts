const { expect } = require("chai");
const hre = require("hardhat");

describe("Test PresaleContract", function () {
    let fbt, sbc, ps;                               // Contract objects
    let ownerContractAddress;      
  
    const totalAmount = 1000000;
    const stableCoinAmount = 9999999999;
    const preSalePrice = 1000;

    beforeEach("Two contracts deployed.", async function () {
        // Reset test environment.
        await hre.network.provider.send("hardhat_reset");
    
        [owner, u1, u2, u3, u4] = await hre.ethers.getSigners();
        ownerContractAddress = owner.address;
        
        const FunBoxToken = await hre.ethers.getContractFactory("FunBoxToken");
        fbt = await FunBoxToken.deploy();
        await fbt.deployed();

        const StableCoin = await hre.ethers.getContractFactory("StableCoinContract");
        sbc = await StableCoin.deploy();
        await sbc.deployed();
    
        const PresaleContract = await hre.ethers.getContractFactory("PresaleContract");
        ps = await PresaleContract.deploy(
            ownerContractAddress,
            preSalePrice,          // _presale price,
            fbt.address  // address _tokenAddress,
        )
        await ps.deployed();
    });

    describe("Dealing with FBT & StableCoins.", function () {
        beforeEach("init coins and whitelists.", async function () {
            expect(await fbt.balanceOf(owner.address)).to.equal(BigInt(10) ** BigInt(27));

            await fbt.transfer(ps.address, totalAmount)
            await sbc.transfer(u1.address, stableCoinAmount);

            await ps.setStableCoinList([sbc.address]);
            await ps.setWhiteLists([u1.address, u2.address, u3.address, u4.address], [100, 1000, 10000, 0]);

            expect(await fbt.balanceOf(ps.address)).to.equal(totalAmount);
        });

        it("Test Get Stable Coin List", async function () {
            const coins = await ps.getStableCoinLists();
            // console.log(coins);
            expect(coins[0]).to.equal(sbc.address);
        });

        it("Test White List", async function () {
            const whitelists = await ps.getWhiteList(0, 3);
            // console.log(whitelists);
            expect(whitelists[0]).to.equal(u1.address);
        });

        it ("Test buyPresale function", async function () {
            const num = 5;
            await expect(ps.connect(u1).buyPresale(sbc.address, 50000000000)).to.be.revertedWith("Exceed the purchase limit");
            await expect(ps.connect(u1).buyPresale(u2.address, num)).to.be.revertedWith("Payment with this type of stablecoin is not supported");

            await sbc.connect(u1).approve(ps.address, 3 * preSalePrice);
            await expect(ps.connect(u1).buyPresale(sbc.address, num)).to.be.revertedWith("Insufficient Stable Coin allowance");

            await sbc.connect(u1).approve(ps.address, num * preSalePrice);
            // await ps.connect(u1).buyPresale(sbc.address, 5);

            expect(await ps.connect(u1).buyPresale(sbc.address, num)).to.emit(ps, "BuyPresale").withArgs(u1.address, sbc.address, num * preSalePrice);


            // console.log(await fbt.balanceOf(ps.address));
            // console.log(await sbc.balanceOf(ps.address));
            // console.log(await fbt.balanceOf(u1.address));
            // console.log(await sbc.balanceOf(u1.address));
            expect(await fbt.balanceOf(u1.address)).to.equal(num);
            expect(await fbt.balanceOf(ps.address)).to.equal(totalAmount - num);
            expect(await sbc.balanceOf(u1.address)).to.equal(stableCoinAmount - num * preSalePrice);
            expect(await sbc.balanceOf(ps.address)).to.equal(num * preSalePrice);
        });

        it ("Test withdrawToken function", async function () {
            const num = 5;
            const amountToWithdraw = 2;
            await sbc.connect(u1).approve(ps.address, num * preSalePrice);
            await ps.connect(u1).buyPresale(sbc.address, num);

            await expect(ps.connect(u1).withdraw(u3.address)).to.be.revertedWith("Only manager has permission");

            expect (await ps.withdrawToken(fbt.address, u3.address, amountToWithdraw)).to.emit(ps, "WithdrawToken").withArgs(fbt.address, u3.address, amountToWithdraw);

            expect(await fbt.balanceOf(ps.address)).to.equal(totalAmount - num - amountToWithdraw);
            expect(await fbt.balanceOf(u3.address)).to.equal(amountToWithdraw);
        });

        it ("Test withdraw function", async function () {
            const num = 5;
            await sbc.connect(u1).approve(ps.address, num * preSalePrice);
            await ps.connect(u1).buyPresale(sbc.address, num);

            await expect(ps.connect(u1).withdraw(u3.address)).to.be.revertedWith("Only manager has permission");

            // await ps.withdraw(u3.address);
            expect (await ps.withdraw(u3.address)).to.emit(ps, "Withdrawed").withArgs(u3.address, (await ps.getTotalSold()));

            // console.log(await fbt.balanceOf(ps.address));
            // console.log(await sbc.balanceOf(ps.address));
            // console.log(await fbt.balanceOf(u3.address));
            // console.log(await sbc.balanceOf(u3.address));
            expect(await fbt.balanceOf(ps.address)).to.equal(0);
            expect(await sbc.balanceOf(ps.address)).to.equal(0);
            expect(await fbt.balanceOf(u3.address)).to.equal(totalAmount - num);
            expect(await sbc.balanceOf(u3.address)).to.equal(num * preSalePrice);
        });

    });
});
