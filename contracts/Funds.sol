// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { LendingPoolAddressesProvider } from "./aave/ILendingPoolAddressesProvider.sol";
import { ILendingPool } from "./aave/ILendingPool.sol";
import { IFunds } from "./interfaces/IFunds.sol";
import { Swap } from "./uniswap/Swap.sol";
import {
    FundHasStarted,
    FundHasEnded,
    FundHasNotEnded
} from "./interfaces/Errors.sol";

contract Funds is IFunds {

    IERC20Metadata stablecoin;
    Swap adapter;
    uint256 public totalValueLocked;
    uint256 public startDate;
    uint256 public matureDate;
    uint256 totalStablecoinAfterUnwind;
    mapping(address => uint256) public depositedAmount;

    modifier beforeStartDate() {
        if (block.timestamp > startDate) {
            revert FundHasStarted(block.timestamp, startDate);
        }
        _;
    }

    modifier beforeEndDate() {
        if (block.timestamp > matureDate) {
            revert FundHasEnded(block.timestamp, matureDate);
        }
        _;
    }

    modifier afterEndDate() {
        if (block.timestamp < matureDate) {
            revert FundHasNotEnded(block.timestamp, matureDate);
        }
        _;
    }

    constructor(
        address _stablecoinAddress,
        uint256 _startDate,
        uint256 _matureDate,
        address _uniswapAdapterAddress
    ) {
        require(
            _startDate < _matureDate,
            "Mature date cannot be sooner than start date"
        );
        stablecoin = IERC20Metadata(_stablecoinAddress);
        startDate = _startDate;
        matureDate = _matureDate;
        adapter = Swap(_uniswapAdapterAddress);
    }

    function deposit(uint256 _amount) public beforeStartDate {
        totalValueLocked += _amount;
        depositedAmount[msg.sender] += _amount;
        stablecoin.transferFrom(msg.sender, address(this), _amount);
    }

    function withdraw() public afterEndDate {
        uint256 entitledAmount = depositedAmount[msg.sender] * totalStablecoinAfterUnwind / totalValueLocked;
        totalValueLocked -= depositedAmount[msg.sender];
        depositedAmount[msg.sender] = 0;
        stablecoin.transfer(msg.sender, entitledAmount);
    }

    function unwindAllPositions() public afterEndDate {

    }

    function supplyToAave(address _underlyingAssetAddress, uint256 _amount) public {
        // get lending pool address (Ethereum mainnet)
        address lendingPoolAddress = LendingPoolAddressesProvider(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5).getLendingPool();

        // approve the lending pool to transfer the underlying asset
        IERC20Metadata(_underlyingAssetAddress).approve(lendingPoolAddress, _amount);
        
        // this contract will receive the associated aToken
        ILendingPool(lendingPoolAddress).deposit(_underlyingAssetAddress, _amount, address(this), 0);
    }

    function withdrawFromAave(address _underlyingAssetAddress, uint256 _amount) public {
        // get lending pool address (Ethereum mainnet)
        address lendingPoolAddress = LendingPoolAddressesProvider(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5).getLendingPool();
        
        // this contract will receive the associated aToken
        ILendingPool(lendingPoolAddress).withdraw(_underlyingAssetAddress, _amount, address(this));
    }

    function borrowFromAave(address _underlyingAssetAddress, uint256 _amount) public {
        // get lending pool address (Ethereum mainnet)
        address lendingPoolAddress = LendingPoolAddressesProvider(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5).getLendingPool();

        // borrow cryptoassets from lending pool - use stable interest rate
        ILendingPool(lendingPoolAddress).borrow(_underlyingAssetAddress, _amount, 1, 0, address(this)); 
    }

    function repayToAave(address _underlyingAssetAddress, uint256 _amount) public {
        // get lending pool address (Ethereum mainnet)
        address lendingPoolAddress = LendingPoolAddressesProvider(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5).getLendingPool();

        // allow lending pool to burn debt token
        IERC20Metadata(_underlyingAssetAddress).approve(lendingPoolAddress, _amount);

        // repay borrow amount
        ILendingPool(lendingPoolAddress).repay(_underlyingAssetAddress, _amount, 1, address(this));
    }

    function swapTokens(address _from, address _to, uint256 _amount) public {
        adapter.swap(_from, _to, _amount);
    }

}
