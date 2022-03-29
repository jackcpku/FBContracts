const { expect } = require("chai");
const hre = require("hardhat");

const { deployNFTGatewayAndNFTFactory } = require("../lib/deploy.js");
const {
  calculateCreate2AddressBasicERC721,
  calculateCreate2AddressBasicERC1155,
} = require("../lib/create2.js");

describe("Test NFTFactory & NFTGateway Contract", function () {
  let gateway, factory;
  let owner, gatewayAdmin, newGatewayAdmin, u2, u3, u4, gatewayManager3, u5, u6;

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
      gatewayManager3,
      u5,
      u6,
    ] = await hre.ethers.getSigners();

    ({ gateway, factory } = await deployNFTGatewayAndNFTFactory(gatewayAdmin));
  });

  it("ERC721 gateway operations", async function () {
    /***************** Preparations ****************/

    // calculate u2ContractAddress deployed using create2
    const from = factory.address;
    const deployeeName = "BasicERC721";
    const tokenName = "U2-contract";
    const tokenSymbol = "U2T";
    const baseURI = "baseURI/";
    const salt = 233;
    const u2ContractAddress = await calculateCreate2AddressBasicERC721(
      from,
      deployeeName,
      tokenName,
      tokenSymbol,
      baseURI,
      gateway.address,
      salt
    );

    // Let u2 deploy the contract.
    await factory
      .connect(u2)
      .deployBasicERC721(tokenName, tokenSymbol, baseURI, salt);
    let u2Contract = await hre.ethers.getContractAt(
      "BasicERC721",
      u2ContractAddress
    );
    expect(await u2Contract.gateway()).to.equal(gateway.address);
    expect((await u2Contract.tokenURI(1234)).toLowerCase()).to.equal(
      `${baseURI}${u2ContractAddress}/${hre.ethers.utils
        .hexZeroPad("0x4d2", 32)
        .toString()}`.toLowerCase()
    );

    /******************** Tests ********************/

    // u2 mints to u2, u3
    await gateway.connect(u2).ERC721_mint(u2Contract.address, u2.address, 222);
    await gateway.connect(u2).ERC721_mint(u2Contract.address, u2.address, 223);
    await gateway.connect(u2).ERC721_mint(u2Contract.address, u3.address, 333);
    expect(await u2Contract.ownerOf(222)).to.equal(u2.address);
    expect(await u2Contract.ownerOf(223)).to.equal(u2.address);
    expect(await u2Contract.ownerOf(333)).to.equal(u3.address);

    //  u2 burns from u2
    await u2Contract.connect(u2).burn(223);
    await expect(u2Contract.ownerOf(223)).to.be.revertedWith(
      "ERC721: owner query for nonexistent token"
    );

    // u2 sets uri of u2Contract
    await gateway.connect(u2).ERC721_setURI(u2Contract.address, "ipfs://");
    expect(await u2Contract.tokenURI(333)).to.equal(
      "ipfs://0x000000000000000000000000000000000000000000000000000000000000014d"
    );
  });

  it("ERC1155 gateway operations", async function () {
    /***************** Preparations ****************/

    // calculate u2ContractAddress deployed using create2
    const from = factory.address;
    const deployeeName = "BasicERC1155";
    const uri = "some uri/";
    const salt = 233;
    const u2ContractAddress = await calculateCreate2AddressBasicERC1155(
      from,
      deployeeName,
      uri,
      gateway.address,
      salt
    );

    // Let u2 deploy the contract.
    await factory.connect(u2).deployBasicERC1155(uri, salt);
    let u2Contract = await hre.ethers.getContractAt(
      deployeeName,
      u2ContractAddress
    );
    expect(await u2Contract.gateway()).to.equal(gateway.address);
    expect((await u2Contract.uri(0)).toLowerCase()).to.equal(
      `${uri}${u2ContractAddress}/{id}`.toLowerCase()
    );

    /******************** Tests ********************/

    const erc1155MintAmount = 10;
    const erc1155BurnAmount = 4;

    // u2 mints to u3
    await gateway
      .connect(u2)
      .ERC1155_mint(
        u2Contract.address,
        u3.address,
        333,
        erc1155MintAmount,
        "0x"
      );

    // mintBatch
    await gateway
      .connect(u2)
      .ERC1155_mintBatch(
        u2Contract.address,
        u2.address,
        [222, 223],
        [erc1155MintAmount, erc1155MintAmount],
        "0x"
      );

    expect(await u2Contract.balanceOf(u2.address, 222)).to.equal(
      erc1155MintAmount
    );
    expect(await u2Contract.balanceOf(u2.address, 223)).to.equal(
      erc1155MintAmount
    );
    expect(await u2Contract.balanceOf(u3.address, 333)).to.equal(
      erc1155MintAmount
    );

    // u2 burns from u2
    await u2Contract.connect(u2).burn(u2.address, 223, erc1155BurnAmount)
    expect(await u2Contract.balanceOf(u2.address, 223)).to.equal(
      erc1155MintAmount - erc1155BurnAmount
    );

    // burnBatch
    await u2Contract.connect(u2).burnBatch(u2.address, [222, 223], [erc1155BurnAmount, erc1155BurnAmount])
    expect(await u2Contract.balanceOf(u2.address, 222)).to.equal(
      erc1155MintAmount - erc1155BurnAmount
    );
    expect(await u2Contract.balanceOf(u2.address, 223)).to.equal(
      erc1155MintAmount - 2 * erc1155BurnAmount
    );

    // u2 sets uri of u2Contract
    await gateway.connect(u2).ERC1155_setURI(u2Contract.address, "ipfs://{id}");
    expect(await u2Contract.uri(333)).to.equal("ipfs://{id}");
  });

  it("should fail to transfer gateway ownership", async function () {
    await expect(
      gateway
        .connect(gatewayAdmin)
        .transferGatewayOwnership(gatewayAdmin.address)
    ).to.be.revertedWith(
      "NFTGateway: new gateway admin should be different than the current one"
    );
  });

  describe("Access control", function () {
    let u2Contract, u3Contract;
    beforeEach("Deploy contracts on behalf of u2 & u3", async function () {
      // calculate u2ContractAddress deployed using create2
      const u2ContractAddress = await calculateCreate2AddressBasicERC721(
        factory.address,
        "BasicERC721",
        "U2-contract",
        "U2T",
        "baseURI",
        gateway.address,
        233
      );

      await factory
        .connect(u2)
        .deployBasicERC721("U2-contract", "U2T", "baseURI", 233);
      u2Contract = await hre.ethers.getContractAt(
        "BasicERC721",
        u2ContractAddress
      );

      // calculate u3ContractAddress deployed using create2
      const u3ContractAddress = await calculateCreate2AddressBasicERC721(
        factory.address,
        "BasicERC721",
        "U3-contract",
        "U3T",
        "baseURI",
        gateway.address,
        233
      );

      await factory
        .connect(u3)
        .deployBasicERC721("U3-contract", "U3T", "baseURI", 233);
      u3Contract = await hre.ethers.getContractAt(
        "BasicERC721",
        u3ContractAddress
      );
    });

    it("NFTGateway manager should not be able to mint on U2-contract", async function () {
      await expect(
        gateway
          .connect(gatewayAdmin)
          .ERC721_mint(u2Contract.address, u2.address, 2)
      ).to.be.revertedWith(
        "NFTGateway: caller is not manager of the nft contract"
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
        "NFTGateway: new gateway should be different than the current one"
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
        "NFTGateway: caller is not manager of the nft contract"
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
