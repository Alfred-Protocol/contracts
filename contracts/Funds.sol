// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IFunds } from "./interfaces/IFunds.sol";
import {
    FundHasStarted,
    FundHasEnded,
    FundHasNotEnded
} from "./interfaces/Errors.sol";

contract Funds is IFunds {

    IERC20Metadata stablecoin;
    uint256 totalValueLocked;
    uint256 startDate;
    uint256 matureDate;
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
        uint256 _matureDate
    ) {
        require(
            _startDate < _matureDate,
            "Mature date cannot be sooner than start date"
        );
        stablecoin = IERC20Metadata(_stablecoinAddress);
        startDate = _startDate;
        matureDate = _matureDate;
    }

    function deposit(uint256 _amount) public beforeStartDate {
        totalValueLocked += _amount;
        stablecoin.transferFrom(msg.sender, address(this), _amount);
    }

    function withdraw() public afterEndDate {
        
    }

    function unwindAllPositions() public afterEndDate {

    }

    function supplyToAave(address _underlyingAssetAddress, uint256 _amount) public {

    }

    function withdrawFromAave(address _underlyingAssetAddress, uint256 _amount) public {

    }

    function borrowFromAave(address _underlyingAssetAddress, uint256 _amount) public {
        
    }

    function repayToAave(address _underlyingAssetAddress, uint256 _amount) public {

    }

    function swapTokens(address _from, address _to, uint256 _amount) public {

    }

}
