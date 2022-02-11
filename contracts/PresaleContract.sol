//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract PresaleContract {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    address public manager;                                          //admin
    address public tokenAddress;                                     //platform token
    uint256 public totalSold;                                        //The total amount of platform coin that has been sold
    
    uint256 public presalePrice;                                     
    uint256 public constant PRICE_DENOMINATOR = 10000;                // tokenprice / USD = presalePrice / PRICE_DENOMINATOR

    EnumerableSet.AddressSet private stableCoinSet;                  // allowed stable coins set

    EnumerableSet.AddressSet private whitelistUserSet;  

    mapping(address => uint256) public limitAmount;                 //map of (addr , max # of token can buy)
    mapping(address => uint256) public boughtAmount;                // map of (addr , # of token has bought)

    uint8 public constant DEFAULT_TOKEN_DECIMAL = 18;                                          
    mapping(address => uint8) private tokenDecimals;                  // token decimals

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

    
    // Add accepted stable coins
    function addStableCoins(address[] calldata stableCoins) external restricted {
        for (uint256 i = 0; i < stableCoins.length; i++) {
            address coin = stableCoins[i];
            stableCoinSet.add(coin);
        }
    }

    // Remove accepted stable coin
    function removeStableCoin(address stableCoin) external restricted {
        stableCoinSet.remove(stableCoin);
    }

    // Set token decimal
    function setTokenDecimal(address token, uint8 decimal) external restricted {
        tokenDecimals[token] = decimal;
    }

    // Set whitelists with limit amounts
    function setWhitelists(address[] calldata addrs, uint256[] calldata amounts) external restricted {
        require(addrs.length == amounts.length, "length of addrs and amounts does not match");
        for (uint256 i = 0; i < addrs.length; i++) {
            limitAmount[addrs[i]] = amounts[i];
            whitelistUserSet.add(addrs[i]);
        }
    }

    // Set whitelist with limit amount
    function setWhitelist(address addr, uint256 amount) external restricted {
        limitAmount[addr] = amount;
        whitelistUserSet.add(addr);
    }

    
    // whitelist user buy presale with stablecoin address:coin & amount:amountToBuy
    function buyPresale(address coin, uint256 amountToBuy) public {
        require(boughtAmount[msg.sender] + amountToBuy <= limitAmount[msg.sender], "Exceed the purchase limit");

        require((IERC20(tokenAddress).balanceOf(address(this))) >= amountToBuy, "Insufficient platform tokens");
        require(stableCoinSet.contains(coin), "Payment with this type of stablecoin is not supported");

        totalSold += amountToBuy;
        boughtAmount[msg.sender] += amountToBuy;

        uint256 cost = calculateCost(coin, amountToBuy);

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

    // the manager withdraw specific token to toAddr
    function withdrawToken(address token, address toAddr, uint256 amount) public restricted {
        emit WithdrawToken(token, toAddr, amount);
        IERC20(token).safeTransfer(
            toAddr,
            amount
        );
    }

    // the manager withdraw rest of tokens including our platform token and stable coin to a new address
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

    function price() external view returns (uint256) {
        return presalePrice;
    }

    // stable coin allowed list
    function stableCoinLists() external view returns (address[] memory) {
        return stableCoinSet.values();
    }

    // The # of platform token held by our contract now
    function totalToken() external view returns (uint256) {
        return IERC20(tokenAddress).balanceOf(address(this));
    }

    // remain # of token for addr can buy
    function remainingAmount(address addr) external view returns (uint256) {
        return limitAmount[addr] - boughtAmount[addr];
    }

    // query white list of [from , to]  0-based 
    function whitelist(uint256 from, uint256 to) external view returns (address[] memory) {
        require(
            (from >= 0) && (from <= to) && (to < whitelistUserSet.length()),

            "Query Params Illegal"
        );

        address[] memory ret = new address[](to - from + 1);
        for (uint i = from; i <= to; i++) {
            ret[i] = whitelistUserSet.at(i);

        }
        return ret;
    }

    // total # of white list user
    function whitelistCnt() external view returns (uint256) {
        return whitelistUserSet.length();
    }

    function tokenDecimal(address coin) public view returns (uint8) {
         if (tokenDecimals[coin] == 0) {
            return DEFAULT_TOKEN_DECIMAL;
        }
        return tokenDecimals[coin];
    }

    /**
        calculate cost of stable coins with diff decimals
     */
    function calculateCost(address coin, uint256 amountToBuy) public view returns (uint256) {
        uint256 cost;
        uint8 coinDec = tokenDecimal(coin);
        uint8 tokenDec = tokenDecimal(tokenAddress);

        if (coinDec >= tokenDec) {
            cost = amountToBuy * presalePrice * (10 ** (coinDec - tokenDec)) / PRICE_DENOMINATOR;
        } else {
            cost = amountToBuy * presalePrice / (10 ** (tokenDec - coinDec)) / PRICE_DENOMINATOR;
        }
        return cost;
    }
    
}


