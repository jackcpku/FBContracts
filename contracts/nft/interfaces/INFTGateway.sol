// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC721Gateway.sol";
import "./IERC1155Gateway.sol";

interface INFTGateway is IERC721Gateway, IERC1155Gateway {}
