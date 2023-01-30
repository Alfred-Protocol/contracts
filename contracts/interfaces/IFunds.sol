// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.9;

interface IFunds {

    /**
     * @notice for users to deposit stablecoin 
     * @param _amount stablecoin amount to be deposited
    **/
    function deposit(uint256 _amount) external;

    /**
     * @notice for users to withdraw their deposits, inclusive of the yield earned (or loss)
     */
    function withdraw() external;

    /**
     * @notice for fund manager to close all positions in Uniswap and Aave and obtain stablecoin
     */
    function unwindAllPositions() external;

    /**
     * @notice for fund manager to supply asset to Aave liquidity pool
     * @param _underlyingAssetAddress address of the asset to be borrowed
     * @param _amount amount to be borrowed
     */
    function supplyToAave(address _underlyingAssetAddress, uint256 _amount) external; 

    /**
     * @notice for fund manager to withdraw asset from Aave liquidity pool
     * @param _underlyingAssetAddress address of the asset to be borrowed
     * @param _amount amount to be borrowed
     */
    function withdrawFromAave(address _underlyingAssetAddress, uint256 _amount) external; 

    /**
     * @notice for fund manager to borrow from Aave liquidity pool
     * @param _underlyingAssetAddress address of the asset to be borrowed
     * @param _amount amount to be borrowed
     */
    function borrowFromAave(address _underlyingAssetAddress, uint256 _amount) external;

    /**
     * @notice for fund manager to repay borrowed from Aave liquidity pool
     * @param _underlyingAssetAddress address of the asset to be borrowed
     * @param _amount amount to be borrowed
     */
    function repayToAave(address _underlyingAssetAddress, uint256 _amount) external;

    /**
     * @notice for fund manager to swap tokens in Uniswap
     * @param _from address of the asset to be swapped
     * @param _to address of the asset to be obtained
     * @param _amount amount of the asset to be obtained
     */
    function swapTokens(address _from, address _to, uint256 _amount) external;
}