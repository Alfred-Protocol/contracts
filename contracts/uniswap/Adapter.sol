// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./interfaces/ISwapRouter.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/base/LiquidityManagement.sol";


contract UniswapAdapter is IERC721Receiver {
    ISwapRouter swapRouter;
    INonfungiblePositionManager nftPositionsManager;

    // LP position
    struct Deposit {
        address owner;
        uint128 liquidity;
        address token0;
        address token1;
    }

    // Map "tokenId" to "Deposit"
    mapping(uint256 => Deposit) public deposits;

    // 0.3% fee
    uint24 public constant poolFee = 3000;

    constructor(address _swapRouter, address _nftPositionsManager) {
        swapRouter = ISwapRouter(_swapRouter);
        nftPositionsManager = INonfungiblePositionManager(_nftPositionsManager);
    }

    function swap(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn
    ) external returns (uint256 amountOut) {
        // Approve pool to spend tokenIn
        TransferHelper.safeApprove(_tokenIn, address(swapRouter), _amountIn);

        // Naively set amountOutMinimum to 0. In production, use an oracle or other data source to choose a safer value for amountOutMinimum.
        // We also set the sqrtPriceLimitx96 to be 0 to ensure we swap our exact input amount.
        // Exact input token amount, output token is not specified
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: _tokenIn,
                tokenOut: _tokenOut,
                fee: poolFee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: _amountIn,
                amountOutMinimum: 0,
                // Slippage tolerance, calculate ith "quote" contract
                sqrtPriceLimitX96: 0
            });

        amountOut = swapRouter.exactInputSingle(params);

        // Transfer tokenOut to msg.sender
        TransferHelper.safeTransfer(_tokenOut, msg.sender, amountOut);
    }

    function _sendToOwner(uint256 tokenId, uint256 amount0, uint256 amount1) internal {
        Deposit memory deposit = deposits[tokenId];
        // Transfer token0 to owner
        TransferHelper.safeTransfer(deposit.token0, deposit.owner, amount0);
        // Transfer token1 to owner
        TransferHelper.safeTransfer(deposit.token1, deposit.owner, amount1);
    }

    function _createDeposit(address owner, uint256 tokenId) internal {
        // https://docs.uniswap.org/contracts/v3/reference/periphery/interfaces/INonfungiblePositionManager
        (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        ) = nftPositionsManager.positions(tokenId);

        deposits[tokenId] = Deposit({
            owner: owner,
            liquidity: liquidity,
            token0: token0,
            token1: token1
        });
    }

    // V3 position is represented by NFT minted from Uniswap V3 NFT Position Manager
    // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC721/IERC721Receiver.sol
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata
    ) external override returns (bytes4) {
        _createDeposit(owner, tokenId);

        return this.onERC721Received.selector;
    }

    function mintPosition(
        uint256 token0,
        uint256 amount0ToMint,
        uint256 token1,
        uint256 amount1ToMint,
        uint24 lowerTick,
        uint24 upperTick
    )
        external
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        // Equal amounts of liquidity in both assets
        TransferHelper.safeTransferFrom(
            amount0,
            msg.sender,
            address(this),
            amount0ToMint
        );
        TransferHelper.safeTransferFrom(
            amount1,
            msg.sender,
            address(this),
            amount1ToMint
        );

        // Approve Uniswap to spend token0 and token1
        TransferHelper.safeApprove(
            token0,
            address(nftPositionsManager),
            amount0ToMint
        );
        TransferHelper.safeApprove(
            token1,
            address(nftPositionsManager),
            amount1ToMint
        );


        // Mint position
        INonfungiblePositionManager.MintParams
            memory params = INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: poolFee,
                // Customize tickLower & tickUpper to optimize swap fees, depending on LP strategy
                tickLower: lowerTick,
                tickUpper: upperTick,
                amount0Desired: amount0ToMint,
                amount1Desired: amount1ToMint,
                // Slippage, risky to front running attacks
                // https://uniswapv3book.com/docs/milestone_3/slippage-protection/
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            });

        (tokenId, liquidity, amount0, amount1) = nftPositionsManager.mint(params);
        
        _createDeposit(msg.sender, tokenId);

        // Refund any remaining tokens that were not used during LP minting
        if (amount0 < amount0ToMint) {
            TransferHelper.safeApprove(token, address(nftPositionsManager), amount0);
            TransferHelper.safeTransfer(
                token0,
                msg.sender,
                amount0ToMint - amount0
            );
        }

        if (amount1 < amount1ToMint) {
            TransferHelper.safeApprove(token, address(nftPositionsManager), amount1);
            TransferHelper.safeTransfer(
                token1,
                msg.sender,
                amount1ToMint - amount1
            );
        }
    }

    function redeemPosition(
        uint256 tokenId
    ) external returns (
        uint256 amount0,
        uint256 amount1
    ) {
        require(deposits[tokenId].owner == msg.sender, "Not owner of position");

        // Transfer NFT to this contract, msg.sender must havbe ownership of NFT
        nftPositionsManager.safeTransferFrom(msg.sender, address(this), tokenId);

        INonfungiblePositionManager.CollectParams memory params = 
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: msg.sender,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });

        (amount0, amount1) = nftPositionsManager.collect(params);
        _sendToOwner(tokenId, amount0, amount1);

        return (
            amount0,
            amount1
        );
    }
}
