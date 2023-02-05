// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

library SharedStructs {
    struct LPPosition {
        address fundManager;
        uint128 liquidity;
        address token0;
        address token1;
        uint256 tokenId;
    }
}
