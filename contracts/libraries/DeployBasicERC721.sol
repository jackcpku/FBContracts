// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../nft/BasicERC721.sol";

library DeployBasicERC721 {
    function deploy(
        address _gatewayAddress,
        string calldata _name,
        string calldata _symbol,
        string calldata _baseURI,
        uint256 _salt
    ) external returns (address) {
        return
            address(
                new BasicERC721{salt: bytes32(_salt)}(
                    _name,
                    _symbol,
                    _baseURI,
                    _gatewayAddress
                )
            );
    }
}
