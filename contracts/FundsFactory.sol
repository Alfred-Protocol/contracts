// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import { Funds } from "./Funds.sol";

contract FundsFactory {

    mapping(address => address) public managerToFundsAddress;

    constructor() {}

    function createNewFund(address _stablecoinAddress, uint256 _startDate, uint256 _matureDate, address _uniswapAdapterAddress) public {
        Funds fundsContract = new Funds(_stablecoinAddress, _startDate, _matureDate, _uniswapAdapterAddress);
        managerToFundsAddress[msg.sender] = address(fundsContract);
    }
}