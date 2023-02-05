// SPDX-License-Identifier: UNLICENSED
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
     * @notice for fund manager to swap tokens in Uniswap
     * @param _from address of the asset to be swapped
     * @param _to address of the asset to be obtained
     * @param _amount amount of the asset to be obtained
     */
    function swapTokens(
        address _from,
        address _to,
        uint256 _amount
    ) external;

    /**
     * @notice for fund manager to mint liquidity position in Uniswap
     * @param token0 address of the first token in the pair
     * @param token1 address of the second token in the pair
     * @param amount0 amount of the first token to be deposited
     * @param amount1 amount of the second token to be deposited
     * @param lowerTick lower tick of the position
     * @param upperTick upper tick of the position
     */
    function createLpPosition(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1,
        int24 lowerTick,
        int24 upperTick,
        uint24 poolFee
    ) external;

    /**
     * @notice for fund manager to redeem fees & liquidity position in Uniswap
     * @param tokenId id of the liquidity position to be redeemed
     */
    function collectFees(uint256 tokenId) external;

    /**
     * @notice for anyone to redeem all liquidity positions in Uniswap
     */
    function redeemAllLpPositions() external;

    /**
     * @notice for fund manager to increase liquidity of a position in Uniswap
     * @param tokenId id of the liquidity position to be increased
     * @param amount0 amount of the first token to be deposited
     * @param amount1 amount of the second token to be deposited
     */
    function increasePositionLiquidity(
        uint256 tokenId,
        uint256 amount0,
        uint256 amount1
    ) external;

    /**
     * @notice for fund manager to decrease liquidity of a position in Uniswap
     * @param tokenId id of the liquidity position to be decreased
     * @param liquidityToRemove amount of liquidity to be removed
     */
    function decreasePositionLiquidity(
        uint256 tokenId,
        uint128 liquidityToRemove
    ) external;
}
