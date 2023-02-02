// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {Funds} from "./Funds.sol";

contract FundsFactory {
    mapping(address => Funds) public managerToFundsAddress;
    Funds[] public funds;

    address private uniswapAdapterAddress;
    address private uniswapNonFungiblePositionManagerAddress;

    constructor(
        address _uniswapAdapterAddress,
        address _uniswapNonFungiblePositionManagerAddress
    ) {
        uniswapAdapterAddress = _uniswapAdapterAddress;
        uniswapNonFungiblePositionManagerAddress = _uniswapNonFungiblePositionManagerAddress;
    }

    function createNewFund(
        address _stablecoinAddress,
        uint256 _startDate,
        uint256 _matureDate
    ) public {
        Funds fundsContract = new Funds(
            _stablecoinAddress,
            _startDate,
            _matureDate,
            uniswapAdapterAddress,
            uniswapNonFungiblePositionManagerAddress
        );
        managerToFundsAddress[msg.sender] = fundsContract;
        funds.push(fundsContract);
    }

    function getAllFunds() public view returns (Funds[] memory) {
        return funds;
    }

    function getFundsByManager(address _manager) public view returns (Funds) {
        return managerToFundsAddress[_manager];
    }
}
