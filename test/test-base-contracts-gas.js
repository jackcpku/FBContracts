const { expect } = require("chai");
const hre = require("hardhat");

const { deployGatewayAndFactories } = require("../lib/deploy.js");
const {
  calculateCreate2AddressBasicERC721,
  calculateCreate2AddressBasicERC1155,
  calculateCreate2AddressBasicERC20,
  calculateCreate2AddressBasicERC20Capped,
} = require("../lib/create2.js");

describe("Test NFTFactory & NFTGateway Contract", function () {
  let gateway, nftfactory, erc20factory;
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

    ({ gateway, nftfactory, erc20factory } = await deployGatewayAndFactories(
      gatewayAdmin
    ));
  });

  it("ERC721 gateway operations", async function () {
    /***************** Preparations ****************/

    // calculate u2ContractAddress deployed using create2
    const from = nftfactory.address;
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
    await nftfactory
      .connect(u2)
      .deployBasicERC721(tokenName, tokenSymbol, baseURI, salt);
    let u2Contract = await hre.ethers.getContractAt(
      "BasicERC721",
      u2ContractAddress
    );

    /******************** Tests ********************/

    // u2 mints to u2, u3
    await gateway.connect(u2).ERC721_mint(u2Contract.address, u2.address, 222);
    await gateway.connect(u2).ERC721_mint(u2Contract.address, u2.address, 223);
    await gateway.connect(u2).ERC721_mint(u2Contract.address, u3.address, 333);

    // u2 transfers to u3
    const tx = await u2Contract
      .connect(u2)
      ["safeTransferFrom(address,address,uint256)"](
        u2.address,
        u3.address,
        222
      );

    const receipt = await tx.wait();
    console.log(
      `Gas used for a single BasicERC721 transfer: ${receipt.gasUsed}`
    );
  });

  it("ERC1155 gateway operations", async function () {
    /***************** Preparations ****************/

    // calculate u2ContractAddress deployed using create2
    const from = nftfactory.address;
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
    await nftfactory.connect(u2).deployBasicERC1155(uri, salt);
    let u2Contract = await hre.ethers.getContractAt(
      deployeeName,
      u2ContractAddress
    );

    /******************** Tests ********************/

    const erc1155MintAmount = 10;

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

    // u2 transfers to u3
    const tx = await u2Contract
      .connect(u2)
      .safeTransferFrom(u2.address, u3.address, 222, 1, "0x");

    const receipt = await tx.wait();
    console.log(
      `Gas used for a single BasicERC1155 transfer: ${receipt.gasUsed}`
    );
  });

  it("ERC20 gateway oprations", async function () {
    const from = erc20factory.address;
    const deployeeName = "BasicERC20";
    const tokenName = "U2-contract";
    const tokenSymbol = "U2T";
    const decimals = 9;
    const salt = 233;
    const u2ContractAddress = await calculateCreate2AddressBasicERC20(
      from,
      deployeeName,
      tokenName,
      tokenSymbol,
      decimals,
      gateway.address,
      salt
    );
    // Let u2 deploy the contract.
    await erc20factory
      .connect(u2)
      .deployBasicERC20(tokenName, tokenSymbol, decimals, salt);
    let u2Contract = await hre.ethers.getContractAt(
      deployeeName,
      u2ContractAddress
    );

    await gateway.connect(gatewayAdmin).addManager(erc20factory.address);

    const initialSupply = 100;
    const transferAmount = 50;

    await gateway
      .connect(u2)
      .ERC20_mint(u2Contract.address, u2.address, initialSupply);

    // u2 transfers to u3
    const tx = await u2Contract
      .connect(u2)
      .transfer(u3.address, transferAmount);

    const receipt = await tx.wait();
    console.log(
      `Gas used for a single BasicERC20 transfer: ${receipt.gasUsed}`
    );
  });
});
