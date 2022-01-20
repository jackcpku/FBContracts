// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.0;

import "./IBaseNFTManagement.sol";

/**
 * The management interface exposed to gateway.
 */
abstract contract BaseNFTManagement is IBaseNFTManagement {
    address public gateway;

    modifier onlyGateway() {
        require(msg.sender == gateway);
        _;
    }

    constructor(address _gateway) {
        gateway = _gateway;
    }

    /**
     * @inheritdoc IBaseNFTManagement
     */
    function setGateway(address _gateway) external override onlyGateway {
        gateway = _gateway;
    }
}
