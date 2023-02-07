// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {Funds} from "./Funds.sol";

contract FundsFactory {
    // Single manager can have many "Funds"
    mapping(address => Funds[]) public managerToFundsAddresses;

    Funds[] public funds;
    address[] public fundAddresses;

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
        uint256 _matureDate,
        string memory _fundName
    ) public {
        Funds fundsContract = new Funds(
            _stablecoinAddress,
            _startDate,
            _matureDate,
            uniswapAdapterAddress,
            uniswapNonFungiblePositionManagerAddress,
            msg.sender,
            _fundName
        );
        managerToFundsAddresses[msg.sender].push(fundsContract);
        funds.push(fundsContract);
        fundAddresses.push(address(fundsContract));
    }

    function getAllFunds() external view returns (Funds[] memory) {
        return funds;
    }

    function getFundsByManager(address _manager)
        external
        view
        returns (Funds[] memory)
    {
        return managerToFundsAddresses[_manager];
    }
}
