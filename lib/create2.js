const hre = require("hardhat");
const {
  hexZeroPad,
  keccak256,
  getCreate2Address,
  AbiCoder,
  hexlify,
  hexConcat,
} = require("ethers/lib/utils");

const calculateCreate2AddressBasicERC721 = async (
  from,
  deployeeName,
  tokenName,
  tokenSymbol,
  baseURI,
  gatewayAddress,
  salt
) => {
  const deployee = await hre.ethers.getContractFactory(deployeeName);
  const saltHexPadded = hexZeroPad(salt, 32);
  const initCode = hexConcat([
    hexlify(deployee.bytecode),
    hexlify(
      new AbiCoder().encode(
        ["string", "string", "string", "address"],
        [tokenName, tokenSymbol, baseURI, gatewayAddress]
      )
    ),
  ]);
  const initCodeHash = keccak256(initCode);
  const calculatedAddress = getCreate2Address(
    from,
    saltHexPadded,
    initCodeHash
  );
  return calculatedAddress;
};

const calculateCreate2AddressBasicERC1155 = async (
  from,
  deployeeName,
  uri,
  gatewayAddress,
  salt
) => {
  const deployee = await hre.ethers.getContractFactory(deployeeName);
  const saltHexPadded = hexZeroPad(salt, 32);
  const initCode = hexConcat([
    hexlify(deployee.bytecode),
    hexlify(
      new AbiCoder().encode(["string", "address"], [uri, gatewayAddress])
    ),
  ]);
  const initCodeHash = keccak256(initCode);
  const calculatedAddress = getCreate2Address(
    from,
    saltHexPadded,
    initCodeHash
  );
  return calculatedAddress;
};

module.exports = {
  calculateCreate2AddressBasicERC721,
  calculateCreate2AddressBasicERC1155,
};
