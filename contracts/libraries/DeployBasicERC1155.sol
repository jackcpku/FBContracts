// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../nft/BasicERC1155.sol";

library DeployBasicERC1155 {
    function deploy(
        address _gatewayAddress,
        string calldata _uri,
        uint256 _salt
    ) external returns (address) {
        return
            address(
                new BasicERC1155{salt: bytes32(_salt)}(_uri, _gatewayAddress)
            );
    }
}
