const { expect } = require("chai");
const { ethers } = require("hardhat");
const hre = require("hardhat");

const { deployNFTGatewayAndNFTFactory } = require('../lib/deploy.js');

describe("Test NFTFactory & NFTGateway Contract", function () {
  let gateway, factory;
  let owner, gatewayAdmin, newGatewayAdmin, u2, u3, u4, anotherFactory, evenAnotherFactory, gatewayManager3, u5, u6;

  beforeEach("Deploy contracts", async function () {
    // Reset test environment.
    await hre.network.provider.send("hardhat_reset");

    [owner, gatewayAdmin, newGatewayAdmin, u2, u3, u4, anotherFactory, evenAnotherFactory, gatewayManager3, u5, u6] = await hre.ethers.getSigners();

    ({ gateway, factory } = await deployNFTGatewayAndNFTFactory(gatewayAdmin));
  });

  it("Should deploy a new contract on behalf of u2", async function () {
    // Similate the call to obtain the return value.
    let u2ContractAddress = await factory.connect(u2).callStatic.deployBasicERC721("U2-contract", "U2T");

    // Let u2 deploy the contract.
    await factory.connect(u2).deployBasicERC721("U2-contract", "U2T");
    let u2Contract = await hre.ethers.getContractAt("BasicERC721", u2ContractAddress);
    expect(await u2Contract.gateway()).to.equal(gateway.address);
  });

  describe("Delegation", function () {
    let u5Contract, u6Contract;

    beforeEach("Deploy contracts on behalf of u5 & u6", async function () {
      let u5ContractAddress = await factory.connect(u5).callStatic.deployBasicERC721("u5-contract", "u5T");
      await factory.connect(u5).deployBasicERC721("u5-contract", "u5T");
      u5Contract = await hre.ethers.getContractAt("BasicERC721", u5ContractAddress);

      let u6ContractAddress = await factory.connect(u6).callStatic.deployBasicERC721("u6-contract", "u6T");
      await factory.connect(u6).deployBasicERC721("u6-contract", "u6T");
      u6Contract = await hre.ethers.getContractAt("BasicERC721", u6ContractAddress);
    });

    const NEVER_EXPIRE = 0;

    it("Anyone should be able to mint NFT to recipient if they have the manager's signature", async function () {
      /**
       * For references
       */
      const saltNonce = "0x0000000000000000000000000000000000000000000000000000000195738178";
      const criteriaMessageHash = ethers.utils.solidityKeccak256(
        ["address", "address", "string", "uint256", "bytes"],
        [
          u5Contract.address,
          u2.address,
          "u5NFT",
          NEVER_EXPIRE,
          saltNonce
        ]
      )
      const u5Sig = await u5.signMessage(ethers.utils.arrayify(criteriaMessageHash));

      // u2 should not be able to mint to a different address
      await expect(gateway.connect(u2).delegatedMint(
        u5Contract.address,
        u3.address,
        "u5NFT",
        NEVER_EXPIRE,
        saltNonce,
        u5Sig
      )).to.be.revertedWith("Gateway: invalid manager signature");

      // u2 should be able to mint to u2 on u5Contract
      await gateway.connect(u2).delegatedMint(
        u5Contract.address,
        u2.address,
        "u5NFT",
        NEVER_EXPIRE,
        saltNonce,
        u5Sig
      );
    });

    it("Anyone should be able to setTokenURI if they have the manager's signature", async function () {
      // First mint an NFT
      await gateway.connect(u5).mint(u5Contract.address, u5.address, "HAHAHA");

      /**
       * For references
       */
      const saltNonce = "0x0000000000000000000000000000000000000000000000000000000195738179";
      const criteriaMessageHash = ethers.utils.solidityKeccak256(
        ["address", "uint256", "string", "uint256", "bytes"],
        [
          u5Contract.address,
          0,
          "u5NFTTTT",
          NEVER_EXPIRE,
          saltNonce
        ]
      )
      const u5Sig = await u5.signMessage(ethers.utils.arrayify(criteriaMessageHash));

      // u2 should be able to setTokenURI on u5Contract
      await gateway.connect(u2).delegatedSetTokenURI(
        u5Contract.address,
        0,
        "u5NFTTTT",
        NEVER_EXPIRE,
        saltNonce,
        u5Sig
      );

      // u2 should not be able to setTokenURI again
      await expect(gateway.connect(u2).delegatedSetTokenURI(
        u5Contract.address,
        0,
        "u5NFTTTT",
        NEVER_EXPIRE,
        saltNonce,
        u5Sig
      )).to.be.revertedWith("Gateway: used manager signature");
    });
  })

  describe("Access control", function () {
    let u2Contract, u3Contract;
    beforeEach("Deploy contracts on behalf of u2 & u3", async function () {
      let u2ContractAddress = await factory.connect(u2).callStatic.deployBasicERC721("U2-contract", "U2T");
      await factory.connect(u2).deployBasicERC721("U2-contract", "U2T");
      u2Contract = await hre.ethers.getContractAt("BasicERC721", u2ContractAddress);

      let u3ContractAddress = await factory.connect(u3).callStatic.deployBasicERC721("U3-contract", "U3T");
      await factory.connect(u3).deployBasicERC721("U3-contract", "U3T");
      u3Contract = await hre.ethers.getContractAt("BasicERC721", u3ContractAddress);
    });

    it("u2 should be able to mint and seturi on U2-contract through gateway", async function () {
      await gateway.connect(u2).mint(u2Contract.address, u2.address, "u2NFT00");
      await gateway.connect(u2).mint(u2Contract.address, u2.address, "u2NFT01");
      await gateway.connect(u2).mint(u2Contract.address, u2.address, "u2NFT02");

      await gateway.connect(u2).setTokenURI(u2Contract.address, 1, "u2NFT01-modified");

      expect(await u2Contract.tokenURI(0)).to.equal("u2NFT00");
      expect(await u2Contract.tokenURI(1)).to.equal("u2NFT01-modified");
      expect(await u2Contract.tokenURI(2)).to.equal("u2NFT02");
    });

    it("u2 should not be able to mint and seturi on U3-contract through gateway", async function () {
      await expect(gateway.connect(u2).mint(u3Contract.address, u2.address, "u3NFT01")).to.be.revertedWith("Unauthorized");

      await gateway.connect(u3).mint(u3Contract.address, u3.address, "u3NFT01");
      await expect(gateway.connect(u2).setTokenURI(u3Contract.address, 1, "u3NFT01-modified")).to.be.revertedWith("Unauthorized");
    });

    it("NFTGateway manager should not be able to mint on U2-contract", async function () {
      await expect(gateway.connect(gatewayAdmin).mint(u2Contract.address, u2.address, "u2NFT01")).to.be.revertedWith("Unauthorized");
    });

    it("u2 should not be able to set gateway of U2-contract", async function () {
      // Either through its own contract
      expect(u2Contract.connect(u2).setGateway(u2.address)).to.be.reverted;

      // Or through gateway contract
      expect(gateway.connect(u2).setGatewayOf(u2Contract.address, u2.address)).to.be.reverted;
    });

    it("NFTGateway manager should be able to set a new gateway of U2-contract only through gateway contract", async function () {
      // Fail: through u2 contract
      expect(u2Contract.connect(gatewayAdmin).setGateway(u2.address)).to.be.reverted;

      // Fail: new gateway address same as the previous one
      await expect(gateway.connect(gatewayAdmin).setGatewayOf(u2Contract.address, gateway.address))
        .to.be.revertedWith("Should assign a different gateway");

      // Success: through gateway contract
      await gateway.connect(gatewayAdmin).setGatewayOf(u2Contract.address, u2.address);
    });

    it("Grace period works", async function () {
      // GatewayAdmin should not be able to manage managers of contracts.
      await expect(gateway.connect(gatewayAdmin).setManagerOf(u3Contract.address, u4.address)).to.be.reverted;

      // GatewayAdmin add a gateway manager gatewayManager3
      await gateway.connect(gatewayAdmin).addManager(gatewayManager3.address);

      // The manager assigns u4 as u3Contract's admin
      await gateway.connect(gatewayManager3).setManagerOf(u3Contract.address, u4.address);

      // u3 should still be able to mint
      await gateway.connect(u3).mint(u3Contract.address, u3.address, "u3-last");

      // u4 should also be able to mint
      await gateway.connect(u4).mint(u3Contract.address, u4.address, "u4-first");

      // Speed up the clock to skip the grace period.
      await hre.network.provider.send("evm_increaseTime", [86401]);

      // After the grace period ends, u3 should not be able to mint any more.
      await expect(gateway.connect(u3).mint(u3Contract.address, u3.address, "u3-fail")).to.be.revertedWith("Unauthorized");
    });

    it("Gateway admin role transfer", async function () {
      // Transfer the ownership to newGatewayAdmin
      await gateway.connect(gatewayAdmin).transferGatewayOwnership(newGatewayAdmin.address);

      // newGatewayAdmin remove gatewayManager3 from managers
      await gateway.connect(newGatewayAdmin).removeManager(gatewayManager3.address);

      // GatewayAdmin should not be able to add a gateway manager
      await expect(gateway.connect(gatewayAdmin).addManager(gatewayManager3.address)).to.be.reverted;

      // newGatewayAdmin adds a gateway manager
      await gateway.connect(newGatewayAdmin).addManager(gatewayManager3.address);
    });
  })
});