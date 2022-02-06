//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

// 最新openzeppelin 还不支持 addr -> uint EnumerableMap 先本地拷贝
import "./utils/AddressToIntEnumerableMap.sol";

contract PresaleContract {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableMap for EnumerableMap.UintToAddressMap;

    using AddressToIntEnumerableMap for AddressToIntEnumerableMap.AddressToUintMap;


    address public manager;         //admin
    address public tokenAddress;    //token
    uint256 presalePrice;           //the token price / USD 
    
    EnumerableSet.AddressSet private stableCoinSet;     //允许使用的稳定币集合

    EnumerableSet.AddressSet private whiteListSet;          //白名单地址集合
    AddressToIntEnumerableMap.AddressToUintMap private limitAmount;  //每个白名单地址的申购数量 限额
    AddressToIntEnumerableMap.AddressToUintMap private boughtAmount; //现在每个白名单地址的 已经购买的额度

    uint totalSold;                 //已经出卖出的平台币总量

    event Withdrawed(address toAddr, uint256 amount);

    constructor (
        address _manager,
        uint256 _presalePrice,
        address _tokenAddress
    ) {
        manager = _manager;
        presalePrice = _presalePrice;
        tokenAddress = _tokenAddress;
    }

    //设允许使用的 稳定币 种类
    function setStableCoinList(address[] memory stableCoins) public {
        require(msg.sender == manager, "Only manager can add stable coin list");
        for (uint256 i = 0; i < stableCoins.length; i++) {
            stableCoinSet.add(stableCoins[i]);
        }
    }

    /**
    设置 修改 白名单 
     */
    function setWhiteLists(address[] memory addrs, uint256[] memory amounts) public {
        require(msg.sender == manager, "Only manager can modify white list");
        for (uint256 i = 0; i < addrs.length; i++) {
            setWhiteList(addrs[i], amounts[i]);
        }
    }

    function setWhiteList(address addr, uint256 amount) internal {
        require(amount >= 0, "white list limit amount must >= 0");
        whiteListSet.add(addr);
        limitAmount.set(addr, amount);
        if (!boughtAmount.contains(addr)) {
            boughtAmount.set(addr, 0);
        }
    }

    /**
        whitelist user buy presale with stablecoin address:coin & amount:amountToBuy
     */
    function buyPresale(address coin, uint256 amountToBuy) public {
        //预售额度
        require(boughtAmount.get(msg.sender) + amountToBuy <= limitAmount.get(msg.sender), "Exceed the purchase limit");
        //合约拥有的平台Token数量足够
        require((IERC20(tokenAddress).balanceOf(address(this))) >= amountToBuy, "Insufficient platform tokens");
        //使用的稳定币是否在稳定币白名单中
        require(stableCoinSet.contains(coin), "Payment with this type of stablecoin is not supported");

        totalSold += amountToBuy;
        boughtAmount.set(msg.sender, boughtAmount.get(msg.sender) + amountToBuy);

        //计算要购买的平台Token对应的稳定币数量
        uint256 cost = presalePrice * amountToBuy;
        //从该白名单地址转移相应数量的稳定币到此合约地址。allowance需要足够
        uint256 allowance = IERC20(coin).allowance(msg.sender, address(this));
        require(allowance >= cost, "Insufficient Stable Coin allowance");
        IERC20(coin).safeTransferFrom(
            msg.sender, address(this), cost
        );
        //从合约地址转移 该白名单用户购买的平台Token到该白名单地址
        IERC20(tokenAddress).safeTransfer(
            msg.sender,
            amountToBuy
        );
    }

    /**
        the manager withdraw rest of tokens including our platform token and stable coin to a new address
     */
    function withdraw(address toAddr) public {
        require(msg.sender == manager, "Only manager can withdraw");

        // emit Withdrawed(toAddr, 0);     //todo amount 

        // send ERC20 token to `toAddr`.
        IERC20(tokenAddress).safeTransfer(
            toAddr,
            IERC20(tokenAddress).balanceOf(address(this))
        );
        // send All kinds of stable coin to toAddr
        for (uint256 i = 0; i < stableCoinSet.length(); i++) {
            IERC20(stableCoinSet.at(i)).safeTransfer(
                toAddr,
                IERC20(stableCoinSet.at(i)).balanceOf(address(this))
            );
        }
    }

    /**
        查询预售价格
    */
    function getPresalePrice() external view returns (uint256) {
        return presalePrice;
    }

    /**
        查询 支持的稳定币 列表
    */
    function getStableCoinLists() external view returns (address[] memory) {
        // address[] memory result = new address[](stableCoinSet.length());
        // for (uint i = 0; i < stableCoinSet.length(); i++) {
        //     result[i] = stableCoinSet.at(i);
        // }
        // return result;
        return stableCoinSet.values();
    }

    /**
        该合约地址 持有的平台币token总量
    */
    function totalToken() external view returns (uint256) {
        return IERC20(tokenAddress).balanceOf(address(this));
    }

    /**
        查询指定地址的预售额度
    */
    function getLimitAmountOfAddress(address addr) external view returns (uint256) {
        return limitAmount.get(addr);
    }

    /**
        查询指定地址已经购买的额度
    */
    function getBoughtAmountOfAddress(address addr) external view returns (uint256) {
        // return boughtAmount[addr];
        return boughtAmount.get(addr);
    }

    /**
        查询指定地址还可以购买的额度
    */
    function getRemainAmountOfAddress(address addr) external view returns (uint256) {
        return limitAmount.get(addr) - boughtAmount.get(addr);
    }

    /**
        查询已经售出的总数量
    */
    function getTotalSold() external view returns (uint256) {
        return totalSold;
    }

    /**
        查询所有预售白名单地址
    */
    function getWhiteList() external view returns (address[] memory) {
        return whiteListSet.values();
    }


    // function getWhiteListLimitAmount() external view returns (address[] memory) {
    //     address[] memory ret = new address[](limitAmount.length());
    //     for (uint i = 0; i < limitAmount.length(); i++) {
    //         // ret[i] = limitAmount.at(i);
    //     }
    //     return ret;
    // }

    /**
        查询某稳定币的allowance
     */
    function getAllowance(address coin) external view returns (uint256) {
        return IERC20(coin).allowance(msg.sender, address(this));
    }
}


