const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const { deployNFTGatewayAndNFTFactory } = require("../lib/deploy.js");

describe("Test NFTFactory & NFTGateway Contract", function () {
  let gateway, factory;
  let owner,
    gatewayAdmin,
    newGatewayAdmin,
    u2,
    u3,
    u4,
    anotherFactory,
    evenAnotherFactory,
    gatewayManager3,
    u5,
    u6;

  beforeEach("Deploy contracts", async function () {
    // Reset test environment.
    await hre.network.provider.send("hardhat_reset");

    [
      owner,
      gatewayAdmin,
      newGatewayAdmin,
      u2,
      u3,
      u4,
      anotherFactory,
      evenAnotherFactory,
      gatewayManager3,
      u5,
      u6,
    ] = await hre.ethers.getSigners();

    ({ gateway, factory } = await deployNFTGatewayAndNFTFactory(gatewayAdmin));
  });

  it("ERC721 gateway operations", async function () {
    /***************** Preparations ****************/

    // Similate the call to obtain the return value.
    let u2ContractAddress = await factory
      .connect(u2)
      .callStatic.deployBaseERC721("U2-contract", "U2T");

    // Let u2 deploy the contract.
    await factory.connect(u2).deployBaseERC721("U2-contract", "U2T");
    let u2Contract = await hre.ethers.getContractAt(
      "ERC721Base",
      u2ContractAddress
    );
    expect(await u2Contract.gateway()).to.equal(gateway.address);

    /******************** Tests ********************/

    // u2 mints to u2, u3
    await gateway.connect(u2).ERC721_mint(u2Contract.address, u2.address, 222);
    await gateway.connect(u2).ERC721_mint(u2Contract.address, u2.address, 223);
    await gateway.connect(u2).ERC721_mint(u2Contract.address, u3.address, 333);
    expect(await u2Contract.ownerOf(222)).to.equal(u2.address);
    expect(await u2Contract.ownerOf(223)).to.equal(u2.address);
    expect(await u2Contract.ownerOf(333)).to.equal(u3.address);

    // After approving gateway, u2 burns from u2
    await u2Contract.connect(u2).approve(gateway.address, 223);
    await gateway.connect(u2).ERC721_burn(u2Contract.address, 223);
    await expect(u2Contract.ownerOf(223)).to.be.revertedWith(
      "ERC721: owner query for nonexistent token"
    );

    // u2 sets uri of u2Contract
    await gateway.connect(u2).ERC721_setURI(u2Contract.address, "ipfs://");
    expect(await u2Contract.tokenURI(333)).to.equal("ipfs://333");
  });

  describe("Access control", function () {
    let u2Contract, u3Contract;
    beforeEach("Deploy contracts on behalf of u2 & u3", async function () {
      let u2ContractAddress = await factory
        .connect(u2)
        .callStatic.deployBaseERC721("U2-contract", "U2T");
      await factory.connect(u2).deployBaseERC721("U2-contract", "U2T");
      u2Contract = await hre.ethers.getContractAt(
        "ERC721Base",
        u2ContractAddress
      );

      let u3ContractAddress = await factory
        .connect(u3)
        .callStatic.deployBaseERC721("U3-contract", "U3T");
      await factory.connect(u3).deployBaseERC721("U3-contract", "U3T");
      u3Contract = await hre.ethers.getContractAt(
        "ERC721Base",
        u3ContractAddress
      );
    });

    it("NFTGateway manager should not be able to mint on U2-contract", async function () {
      await expect(
        gateway
          .connect(gatewayAdmin)
          .ERC721_mint(u2Contract.address, u2.address, 2)
      ).to.be.revertedWith(
        "Gateway: caller is not manager of the nft contract"
      );
    });

    it("u2 should not be able to set gateway of U2-contract", async function () {
      // Either through its own contract
      expect(u2Contract.connect(u2).setGateway(u2.address)).to.be.reverted;

      // Or through gateway contract
      expect(gateway.connect(u2).setGatewayOf(u2Contract.address, u2.address))
        .to.be.reverted;
    });

    it("NFTGateway manager should be able to set a new gateway of U2-contract only through gateway contract", async function () {
      // Fail: through u2 contract
      expect(u2Contract.connect(gatewayAdmin).setGateway(u2.address)).to.be
        .reverted;

      // Fail: new gateway address same as the previous one
      await expect(
        gateway
          .connect(gatewayAdmin)
          .setGatewayOf(u2Contract.address, gateway.address)
      ).to.be.revertedWith(
        "Gateway: new gateway should be different than the current one"
      );

      // Success: through gateway contract
      await gateway
        .connect(gatewayAdmin)
        .setGatewayOf(u2Contract.address, u2.address);
    });

    it("Grace period works", async function () {
      // GatewayAdmin should not be able to manage managers of contracts.
      await expect(
        gateway
          .connect(gatewayAdmin)
          .setManagerOf(u3Contract.address, u4.address)
      ).to.be.reverted;

      // GatewayAdmin add a gateway manager gatewayManager3
      await gateway.connect(gatewayAdmin).addManager(gatewayManager3.address);

      // The manager assigns u4 as u3Contract's admin
      await gateway
        .connect(gatewayManager3)
        .setManagerOf(u3Contract.address, u4.address);

      // u3 should still be able to mint
      await gateway.connect(u3).ERC721_mint(u3Contract.address, u3.address, 3);

      // u4 should also be able to mint
      await gateway.connect(u4).ERC721_mint(u3Contract.address, u4.address, 4);

      // Speed up the clock to skip the grace period.
      await hre.network.provider.send("evm_increaseTime", [86401]);

      // After the grace period ends, u3 should not be able to mint any more.
      await expect(
        gateway.connect(u3).ERC721_mint(u3Contract.address, u3.address, 33)
      ).to.be.revertedWith(
        "Gateway: caller is not manager of the nft contract"
      );
    });

    it("Gateway admin role transfer", async function () {
      // Transfer the ownership to newGatewayAdmin
      await gateway
        .connect(gatewayAdmin)
        .transferGatewayOwnership(newGatewayAdmin.address);

      // newGatewayAdmin remove gatewayManager3 from managers
      await gateway
        .connect(newGatewayAdmin)
        .removeManager(gatewayManager3.address);

      // GatewayAdmin should not be able to add a gateway manager
      await expect(
        gateway.connect(gatewayAdmin).addManager(gatewayManager3.address)
      ).to.be.reverted;

      // newGatewayAdmin adds a gateway manager
      await gateway
        .connect(newGatewayAdmin)
        .addManager(gatewayManager3.address);
    });
  });
});
