//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

// lasted version of openzeppelin does not support addr -> uint EnumerableMap, just copy ToDo remove
import "./utils/AddressToIntEnumerableMap.sol";

contract PresaleContract {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableMap for EnumerableMap.UintToAddressMap;
    using AddressToIntEnumerableMap for AddressToIntEnumerableMap.AddressToUintMap;

    address public manager;         //admin
    address public tokenAddress;    //platform token
    uint256 presalePrice;           //the token price / USD 
    uint256 totalSold;              //The total amount of platform coin that has been sold

    EnumerableSet.AddressSet private stableCoinSet;                  // allowed stable coins set
    AddressToIntEnumerableMap.AddressToUintMap private limitAmount;  // map of (addr , max # of token can buy)
    AddressToIntEnumerableMap.AddressToUintMap private boughtAmount; // map of (addr , # of token has bought)

    event BuyPresale(address indexed buyer, address indexed coin, uint256 amount);
    event WithdrawToken(address indexed token, address indexed toAddr, uint256 amount);
    event Withdrawed(address indexed toAddr, uint256 totalSold);

    modifier restricted() {
        require(msg.sender == manager, "Only manager has permission"); //only manager can modify this 
        _;
    }

    constructor (
        address _manager,
        uint256 _presalePrice,
        address _tokenAddress
    ) {
        manager = _manager;
        presalePrice = _presalePrice;
        tokenAddress = _tokenAddress;
    }

    /**
        add accepted stable coin 
     */
    function setStableCoinList(address[] memory stableCoins) public restricted {
        for (uint256 i = 0; i < stableCoins.length; i++) {
            stableCoinSet.add(stableCoins[i]);
        }
    }

    /**
        set whitelists with limit amounts
     */
    function setWhiteLists(address[] memory addrs, uint256[] memory amounts) public restricted {
        for (uint256 i = 0; i < addrs.length; i++) {
            setWhiteList(addrs[i], amounts[i]);
        }
    }

    /**
        set whitelist with limit amount
     */
    function setWhiteList(address addr, uint256 amount) internal {
        require(amount >= 0, "white list limit amount must >= 0");
        limitAmount.set(addr, amount);
        if (!boughtAmount.contains(addr)) {
            boughtAmount.set(addr, 0);
        }
    }

    /**
        whitelist user buy presale with stablecoin address:coin & amount:amountToBuy
     */
    function buyPresale(address coin, uint256 amountToBuy) public {
        require(boughtAmount.get(msg.sender) + amountToBuy <= limitAmount.get(msg.sender), "Exceed the purchase limit");
        require((IERC20(tokenAddress).balanceOf(address(this))) >= amountToBuy, "Insufficient platform tokens");
        require(stableCoinSet.contains(coin), "Payment with this type of stablecoin is not supported");

        totalSold += amountToBuy;
        boughtAmount.set(msg.sender, boughtAmount.get(msg.sender) + amountToBuy);

        //1. todo decimal
        uint256 cost = presalePrice * amountToBuy;

        //Transfer the corresponding amount of stablecoins from the whitelisted address to this contract address. 
        //allowance needs to be enough
        uint256 allowance = IERC20(coin).allowance(msg.sender, address(this));
        require(allowance >= cost, "Insufficient Stable Coin allowance");

        emit BuyPresale(msg.sender, coin, cost);

        IERC20(coin).safeTransferFrom(
            msg.sender, address(this), cost
        );

        // send ERC20 token to `buyer`.
        IERC20(tokenAddress).safeTransfer(
            msg.sender,
            amountToBuy
        );
    }

    /**
        the manager withdraw specific token to toAddr
     */
    function withdrawToken(address token, address toAddr, uint256 amount) public restricted {
        emit WithdrawToken(token, toAddr, amount);
        IERC20(token).safeTransfer(
            toAddr,
            amount
        );
    }

    /**
        the manager withdraw rest of tokens including our platform token and stable coin to a new address
     */
    function withdraw(address toAddr) public restricted {
        emit Withdrawed(toAddr, totalSold);     

        // send ERC20 token to `toAddr`.
        IERC20(tokenAddress).safeTransfer(
            toAddr,
            IERC20(tokenAddress).balanceOf(address(this))
        );
        // send All kinds of stable coin to toAddr
        for (uint256 i = 0; i < stableCoinSet.length(); i++) {
            address coin = stableCoinSet.at(i);
            IERC20(coin).safeTransfer(
                toAddr,
                IERC20(coin).balanceOf(address(this))
            );
        }
    }

    function getPresalePrice() external view returns (uint256) {
        return presalePrice;
    }

    /**
        stable coin allowed list
     */
    function getStableCoinLists() external view returns (address[] memory) {
        return stableCoinSet.values();
    }

    /**
        The # of platform token held by our contract now
     */
    function totalToken() external view returns (uint256) {
        return IERC20(tokenAddress).balanceOf(address(this));
    }

    /**
        ceil # of token for addr
     */
    function getLimitAmountOfAddress(address addr) external view returns (uint256) {
        return limitAmount.get(addr);
    }

    /**
        has bought # of token for addr
     */
    function getBoughtAmountOfAddress(address addr) external view returns (uint256) {
        return boughtAmount.get(addr);
    }

    /**
        remain # of token for addr can buy
     */
    function getRemainAmountOfAddress(address addr) external view returns (uint256) {
        return limitAmount.get(addr) - boughtAmount.get(addr);
    }

    /**
       sum # of platform token has been sold
     */
    function getTotalSold() external view returns (uint256) {
        return totalSold;
    }

    /**
        query white list of [from , to]  0-based 
     */
    function getWhiteList(uint256 from, uint256 to) external view returns (address[] memory) {
        require(
            (from >= 0) && (from <= to) && (to < limitAmount.length()),
            "Query Params Illegal"
        );

        address[] memory ret = new address[](to - from + 1);
        for (uint i = from; i <= to; i++) {
            (ret[i], ) = limitAmount.at(i);
        }
        return ret;
    }

    /**
        total # of white list user
     */
    function numberOfWhiteList() external view returns (uint256) {
        return limitAmount.length();
    }
}


