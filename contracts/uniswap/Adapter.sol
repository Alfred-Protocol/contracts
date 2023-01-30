pragma solidity ^0.8.0;

import "./ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

contract UniswapAdapter {
    ISwapRouter swapRouter;

    // 0.3% fee
    uint24 public constant poolFee = 3000;

    constructor(address _swapRouter) {
        swapRouter = ISwapRouter(_swapRouter);
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
                sqrtPriceLimitX96: 0
            });

        amountOut = swapRouter.exactInputSingle(params);

        // Transfer tokenOut to msg.sender
        TransferHelper.safeTransfer(_tokenOut, msg.sender, amountOut);
    }
}
