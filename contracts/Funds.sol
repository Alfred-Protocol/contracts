// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {LendingPoolAddressesProvider} from "./aave/ILendingPoolAddressesProvider.sol";
import {ILendingPool} from "./aave/ILendingPool.sol";
import {IFunds} from "./interfaces/IFunds.sol";
import {Swap} from "./uniswap/Swap.sol";
import {LiquidityProvider} from "./uniswap/LiquidityProvider.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import {SharedStructs} from "./uniswap/Structs.sol";
import {FundHasStarted, FundHasEnded, FundHasNotEnded, CallerIsNotFundManager} from "./interfaces/Errors.sol";

contract Funds is IFunds {
    using EnumerableMap for EnumerableMap.AddressToUintMap;

    IERC20Metadata public immutable stablecoin;

    Swap immutable swapAdapter;
    LiquidityProvider immutable liquidityProvider;

    uint256 public totalValueLocked;
    uint256 public startDate;
    uint256 public matureDate;
    uint256 public totalStablecoinAfterUnwind;

    // Manager of fund
    address public fundManager;

    // How much each depositor has deposited (initially)
    EnumerableMap.AddressToUintMap private depositorToAmount;

    // Tracks the ERC20 token swaps that have been made, and LP positions balances
    EnumerableMap.AddressToUintMap private tokenToAmount;

    event PositionMinted(uint256 tokenId);

    modifier beforeStartDate() {
        if (block.timestamp > startDate) {
            revert FundHasStarted(block.timestamp, startDate);
        }
        _;
    }

    modifier beforeEndDate() {
        if (block.timestamp > matureDate) {
            revert FundHasEnded(block.timestamp, matureDate);
        }
        _;
    }

    modifier afterEndDate() {
        if (block.timestamp < matureDate) {
            revert FundHasNotEnded(block.timestamp, matureDate);
        }
        _;
    }

    modifier _onlyFundManager() {
        if (msg.sender != fundManager) {
            revert CallerIsNotFundManager(fundManager);
        }
        _;
    }

    constructor(
        address _stablecoinAddress,
        uint256 _startDate,
        uint256 _matureDate,
        address _uniswapswapAdapterAddress,
        address _uniswapNonFungiblePositionManagerAddress,
        address _fundManager
    ) {
        require(
            _startDate < _matureDate,
            "Mature date cannot be sooner than start date"
        );

        stablecoin = IERC20Metadata(_stablecoinAddress);
        startDate = _startDate;
        matureDate = _matureDate;
        swapAdapter = Swap(_uniswapswapAdapterAddress);
        liquidityProvider = LiquidityProvider(
            _uniswapNonFungiblePositionManagerAddress
        );
        fundManager = _fundManager;
    }

    function depositedAmount(address _depositor) public view returns (uint256) {
        (, uint256 amount) = EnumerableMap.tryGet(
            depositorToAmount,
            _depositor
        );
        return amount;
    }

    function _increaseTokenBalance(address _token, uint256 _amount) internal {
        (, uint256 existingAmount) = EnumerableMap.tryGet(
            tokenToAmount,
            _token
        );
        EnumerableMap.set(tokenToAmount, _token, existingAmount + _amount);
    }

    function _decreaseTokenBalance(address _token, uint256 _amount) internal {
        (, uint256 existingAmount) = EnumerableMap.tryGet(
            tokenToAmount,
            _token
        );

        require(
            existingAmount >= _amount,
            "Cannot decrease token balance by more than the existing amount"
        );

        EnumerableMap.set(tokenToAmount, _token, existingAmount - _amount);
    }

    function deposit(uint256 _amount) public beforeStartDate {
        require(_amount > 0, "Amount deposited must be greater than 0");

        totalValueLocked += _amount;

        (, uint256 existingDepositorAmount) = EnumerableMap.tryGet(
            depositorToAmount,
            msg.sender
        );
        EnumerableMap.set(
            depositorToAmount,
            msg.sender,
            existingDepositorAmount + _amount
        );

        _increaseTokenBalance(address(stablecoin), _amount);

        // Assume user has already approved the transfer
        stablecoin.transferFrom(msg.sender, address(this), _amount);
    }

    function withdraw() public afterEndDate {
        (, uint256 initialDepositedAmount) = EnumerableMap.tryGet(
            depositorToAmount,
            msg.sender
        );

        uint256 entitledAmount = (initialDepositedAmount / totalValueLocked) *
            totalStablecoinAfterUnwind;
        totalValueLocked -= initialDepositedAmount;
        EnumerableMap.set(depositorToAmount, msg.sender, 0);

        _decreaseTokenBalance(address(stablecoin), entitledAmount);

        stablecoin.transfer(msg.sender, entitledAmount);
    }

    function swapTokens(
        address _from,
        address _to,
        uint256 _amount
    ) public {
        IERC20Metadata(_from).approve(address(swapAdapter), _amount);

        uint256 amountOut = swapAdapter.swap(_from, _to, _amount);

        _decreaseTokenBalance(_from, _amount);
        _increaseTokenBalance(_to, amountOut);
    }

    /**
     * @dev Creates a liquidity position on Uniswap V3
     */
    function createLpPosition(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1,
        int24 lowerTick,
        int24 upperTick,
        uint24 poolFee
    ) public _onlyFundManager {
        IERC20Metadata(token0).approve(address(liquidityProvider), amount0);
        IERC20Metadata(token1).approve(address(liquidityProvider), amount1);

        (
            uint256 tokenId,
            ,
            uint256 amount0Minted,
            uint256 amount1Minted
        ) = liquidityProvider.mintPosition(
                token0,
                amount0,
                token1,
                amount1,
                lowerTick,
                upperTick,
                poolFee
            );

        _decreaseTokenBalance(token0, amount0Minted);
        _decreaseTokenBalance(token1, amount1Minted);

        emit PositionMinted(tokenId);
    }

    function collectFees(uint256 tokenId) public {
        (
            uint256 amount0,
            uint256 amount1,
            address token0,
            address token1
        ) = liquidityProvider.collectFees(tokenId);

        _increaseTokenBalance(token0, amount0);
        _increaseTokenBalance(token1, amount1);
    }

    // Close LP position
    function closeLpPosition(uint256 tokenId) public {
        SharedStructs.LPPosition memory lpPos = liquidityProvider
            .getLpPositionDetails(tokenId);

        (uint256 amount0, uint256 amount1, , ) = liquidityProvider
            .decreasePositionLiquidity(tokenId, lpPos.liquidity, fundManager);

        (
            uint256 amount0Fees,
            uint256 amount1Fees,
            address token0,
            address token1
        ) = liquidityProvider.collectFees(tokenId);

        liquidityProvider.burnPosition(tokenId);

        _increaseTokenBalance(token0, amount0Fees + amount0);
        _increaseTokenBalance(token1, amount1Fees + amount1);
    }

    function increasePositionLiquidity(
        uint256 tokenId,
        uint256 amount0ToAdd,
        uint256 amount1ToAdd
    ) public {
        (, uint256 amount0, uint256 amount1, address token0, address token1) = liquidityProvider
            .increasePositionLiquidity(
                tokenId,
                amount0ToAdd,
                amount1ToAdd,
                // Assumed to be "fund manager"
                msg.sender
            );

        _decreaseTokenBalance(token0, amount0);
        _decreaseTokenBalance(token1, amount1);
    }

    function decreasePositionLiquidity(
        uint256 tokenId,
        uint128 liquidityToRemove
    ) public {
        (uint256 amount0, uint256 amount1, address token0, address token1) = liquidityProvider
            .decreasePositionLiquidity(
                tokenId,
                liquidityToRemove,
                // Assumed to be "fund manager"
                msg.sender
            );

        _increaseTokenBalance(token0, amount0);
        _increaseTokenBalance(token1, amount1);
    }

    // Anyone can call this function to redeem the LP position
    function redeemAllLpPositions() public afterEndDate {
        uint256[] memory tokenIds = liquidityProvider.getLpPositionsTokenIds();
        for (uint256 i = 0; i < tokenIds.length; i++) {
            // Collect fees, decrease liquidity & burn NFT
            closeLpPosition(tokenIds[i]);
        }

        for (uint256 i = 0; i < EnumerableMap.length(tokenToAmount); i++) {
            (address tokenAddress, ) = EnumerableMap.at(tokenToAmount, i);

            if (
                tokenAddress != address(0) &&
                tokenAddress != address(stablecoin)
            ) {
                swapTokens(
                    tokenAddress,
                    address(stablecoin),
                    IERC20Metadata(tokenAddress).balanceOf(address(this))
                );
            }
        }

        totalStablecoinAfterUnwind = stablecoin.balanceOf(address(this));
    }

    function fetchAllLpPositions()
        public
        view
        returns (SharedStructs.LPPosition[] memory)
    {
        return liquidityProvider.getActiveLpPositions();
    }

    function fetchLpTokenIds() public view returns (uint256[] memory) {
        return liquidityProvider.getLpPositionsTokenIds();
    }
}
