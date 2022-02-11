// SPDX-License-Identifier: Unlicensed

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FunBoxToken is ERC20 {
    
    constructor(address wallet) ERC20("FunBoxToken", "FBT") {
        _mint(wallet, 1_000_000_000 * 10**18);
    }

}