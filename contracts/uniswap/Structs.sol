// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

library SharedStructs {
    // https://docs.uniswap.org/contracts/v3/reference/periphery/interfaces/INonfungiblePositionManager#positions
    struct LPPosition {
        address fundManager;
        uint256 tokenId;
        // Retrieved from Uniswap "positions" function
        uint128 liquidity;
        address token0;
        address token1;
        int24 tickLower;
        int24 tickUpper;
        uint24 poolFee;
    }
}
