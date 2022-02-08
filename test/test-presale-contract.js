const { expect } = require("chai");
const hre = require("hardhat");

describe("Test PresaleContract", function () {
    let fbt, sbc, usdt, ps;                               // Contract objects
    let ownerContractAddress;      
  
    const totalAmount = BigInt(1000000) * BigInt(10) ** BigInt(18);
    const stableCoinAmount = BigInt(50000000) * BigInt(10) ** BigInt(18);
    const preSalePrice = BigInt(1000);
    const PRICE_DENOMINATOR = BigInt(10000);

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

        const USDT = await hre.ethers.getContractFactory("USDT");
        usdt = await USDT.deploy();
        await usdt.deployed();
    
        const PresaleContract = await hre.ethers.getContractFactory("PresaleContract");
        ps = await PresaleContract.deploy(
            ownerContractAddress,
            preSalePrice,          // _presale price,
            fbt.address  // address _tokenAddress,
        )
        await ps.deployed();
    });


    describe("Dealing with non-18 StableCoins.", function () {
        beforeEach("init stable coins", async function () {
            await ps.setStableCoinList([sbc.address, usdt.address]);
        });

        it("Test coinDecimals", async function () {
            const coins = await ps.stableCoinLists();
            // console.log(coins);
            expect(coins[0]).to.equal(sbc.address);
            expect(coins[1]).to.equal(usdt.address);
            // console.log(await ps.coinDecimal(coins[0]));
            // console.log(await ps.coinDecimal(coins[1]));
            expect(await ps.coinDecimal(coins[1])).to.equal(6);
        });

        it("Test caculateCost", async function () {
            const coins = await ps.stableCoinLists();
            const amountToBuy = BigInt(5) * BigInt(10) ** BigInt(18)
            // console.log(amountToBuy);

            // console.log(await sbc.decimals());
            // console.log(await ps.coinDecimal(coins[0]));
            // console.log(await ps.calculateCost(coins[0], amountToBuy));

            // console.log(await usdt.decimals());
            // console.log(await ps.coinDecimal(coins[1]));
            // console.log(await ps.calculateCost(coins[1], amountToBuy));

            const div =  BigInt(10) ** BigInt((await fbt.decimals()) - (await usdt.decimals()));
            expect(await ps.calculateCost(coins[1], amountToBuy)).to.equal(
                amountToBuy * preSalePrice / PRICE_DENOMINATOR / div);
        });
    });
    




    describe("Dealing with FBT & StableCoins.", function () {
        beforeEach("init coins and whitelists.", async function () {
            expect(await fbt.balanceOf(owner.address)).to.equal(BigInt(10) ** BigInt(27));

            await fbt.transfer(ps.address, totalAmount)
            // console.log(await sbc.balanceOf(sbc.address));
            // console.log(await sbc.balanceOf(u1.address));
            await sbc.transfer(u1.address, stableCoinAmount);

            await ps.setStableCoinList([sbc.address]);
            await ps.setWhiteLists(
                [u1.address, u2.address, u3.address, u4.address], 
                [BigInt(100) * BigInt(10) ** BigInt(18), BigInt(1000) * BigInt(10) ** BigInt(18), BigInt(10000) * BigInt(10) ** BigInt(18), 0]);

            expect(await fbt.balanceOf(ps.address)).to.equal(totalAmount);
        });

        it("Test Get Stable Coin List", async function () {
            const coins = await ps.stableCoinLists();
            // console.log(coins);
            expect(coins[0]).to.equal(sbc.address);
        });

        it("Test White List", async function () {
            const whitelists = await ps.whiteList(0, 3);
            // console.log(whitelists);
            expect(whitelists[0]).to.equal(u1.address);
        });

        it ("Test buyPresale function", async function () {
            const num = BigInt(5) * BigInt(10) ** BigInt(18);
            await expect(ps.connect(u1).buyPresale(sbc.address, BigInt(5) * BigInt(10) ** BigInt(30))).to.be.revertedWith("Exceed the purchase limit");
            await expect(ps.connect(u1).buyPresale(u2.address, num)).to.be.revertedWith("Payment with this type of stablecoin is not supported");

            await sbc.connect(u1).approve(ps.address, BigInt(3));
            await expect(ps.connect(u1).buyPresale(sbc.address, num)).to.be.revertedWith("Insufficient Stable Coin allowance");


            const cost = BigInt(await ps.calculateCost(sbc.address, num));
            await sbc.connect(u1).approve(ps.address, cost);
            // await ps.connect(u1).buyPresale(sbc.address, 5);

            expect(await ps.connect(u1).buyPresale(sbc.address, num)).to.emit(ps, "BuyPresale").withArgs(u1.address, sbc.address, cost);


            // console.log(await fbt.balanceOf(ps.address));
            // console.log(await sbc.balanceOf(ps.address));
            // console.log(await fbt.balanceOf(u1.address));
            // console.log(await sbc.balanceOf(u1.address));
            expect(await fbt.balanceOf(u1.address)).to.equal(num);
            expect(await fbt.balanceOf(ps.address)).to.equal(totalAmount - num);
            expect(await sbc.balanceOf(u1.address)).to.equal(stableCoinAmount - cost);
            expect(await sbc.balanceOf(ps.address)).to.equal(cost);
        });

        it ("Test withdrawToken function", async function () {
            const num = BigInt(5) * BigInt(10) ** BigInt(18);
            const amountToWithdraw = BigInt(2) * BigInt(10) ** BigInt(18);

            const cost = BigInt(await ps.calculateCost(sbc.address, num));

            await sbc.connect(u1).approve(ps.address, cost);
            await ps.connect(u1).buyPresale(sbc.address, num);

            await expect(ps.connect(u1).withdraw(u3.address)).to.be.revertedWith("Only manager has permission");

            expect (await ps.withdrawToken(fbt.address, u3.address, amountToWithdraw)).to.emit(ps, "WithdrawToken").withArgs(fbt.address, u3.address, amountToWithdraw);

            expect(await fbt.balanceOf(ps.address)).to.equal(totalAmount - num - amountToWithdraw);
            expect(await fbt.balanceOf(u3.address)).to.equal(amountToWithdraw);
        });

        it ("Test withdraw function", async function () {
            const num = BigInt(5) * BigInt(10) ** BigInt(18);;
            const cost = BigInt(await ps.calculateCost(sbc.address, num));

            await sbc.connect(u1).approve(ps.address, cost);
            await ps.connect(u1).buyPresale(sbc.address, num);

            await expect(ps.connect(u1).withdraw(u3.address)).to.be.revertedWith("Only manager has permission");

            // await ps.withdraw(u3.address);
            expect (await ps.withdraw(u3.address)).to.emit(ps, "Withdrawed").withArgs(u3.address, (await ps.soldAmount()));

            // console.log(await fbt.balanceOf(ps.address));
            // console.log(await sbc.balanceOf(ps.address));
            // console.log(await fbt.balanceOf(u3.address));
            // console.log(await sbc.balanceOf(u3.address));
            expect(await fbt.balanceOf(ps.address)).to.equal(0);
            expect(await sbc.balanceOf(ps.address)).to.equal(0);
            expect(await fbt.balanceOf(u3.address)).to.equal(totalAmount - num);
            expect(await sbc.balanceOf(u3.address)).to.equal(cost);
        });

    });
});
