// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.9;

interface IFundsFactory {

    /**
     * @notice for fund managers to create new basket of fund
     * @param _stablecoinAddress stablecoin that the fund manager wants to use
     * @param _startDate starting date of the fund
     * @param _matureDate end date of the fund
     * @param _uniswapRouterAddress router address of uniswap
    **/
    function createNewFund(address _stablecoinAddress, uint256 _startDate, uint256 _matureDate, address _uniswapRouterAddress) external;

}