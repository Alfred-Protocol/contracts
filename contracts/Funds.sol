// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {LendingPoolAddressesProvider} from "./aave/ILendingPoolAddressesProvider.sol";
import {ILendingPool} from "./aave/ILendingPool.sol";
import {IFunds} from "./interfaces/IFunds.sol";
import {Swap} from "./uniswap/Swap.sol";
import {LiquidityProvider} from "./uniswap/LiquidityProvider.sol";

import {FundHasStarted, FundHasEnded, FundHasNotEnded} from "./interfaces/Errors.sol";

contract Funds is IFunds {
    IERC20Metadata public immutable stablecoin;

    Swap immutable swapAdapter;
    LiquidityProvider immutable liquidityProvider;

    uint256 public totalValueLocked;
    uint256 public startDate;
    uint256 public matureDate;
    uint256 public totalStablecoinAfterUnwind;

    // Keep track of stable coin balances for each user
    mapping(address => uint256) public depositedAmount;
    address[] depositors;

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
        // TODO: Whitelisting strategy to only allow fund manager to call this function
        _;
    }

    constructor(
        address _stablecoinAddress,
        uint256 _startDate,
        uint256 _matureDate,
        address _uniswapswapAdapterAddress,
        address _uniswapNonFungiblePositionManagerAddress
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
    }

    function deposit(uint256 _amount) public beforeStartDate {
        totalValueLocked += _amount;
        // New depositor
        if (depositedAmount[msg.sender] == 0) {
            depositors.push(msg.sender);
        }
        depositedAmount[msg.sender] += _amount;
        // Assume user has already approved the transfer
        stablecoin.transferFrom(msg.sender, address(this), _amount);
    }

    function withdraw() public afterEndDate {
        uint256 entitledAmount = (depositedAmount[msg.sender] *
            totalStablecoinAfterUnwind) / totalValueLocked;
        totalValueLocked -= depositedAmount[msg.sender];
        depositedAmount[msg.sender] = 0;
        stablecoin.transfer(msg.sender, entitledAmount);
    }

    function unwindAllPositions() public afterEndDate {
        // Burn LP NFTs
        // Transfer to intended receiver
    }

    function swapTokens(
        address _from,
        address _to,
        uint256 _amount
    ) public {
        stablecoin.approve(address(swapAdapter), _amount);
        swapAdapter.swap(_from, _to, _amount);
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
        int24 upperTick
    ) public _onlyFundManager {
        IERC20Metadata(token0).approve(address(liquidityProvider), amount0);
        IERC20Metadata(token1).approve(address(liquidityProvider), amount1);

        (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        ) = liquidityProvider.mintPosition(
                token0,
                amount0,
                token1,
                amount1,
                lowerTick,
                upperTick
            );

        emit PositionMinted(tokenId);
    }

    function redeemLpPosition(uint256 tokenId) public _onlyFundManager {
        liquidityProvider.redeemPosition(tokenId);
    }

    // Anyone can call this function to redeem the LP position
    function redeemAllLpPositions() public afterEndDate {
        uint256[] memory tokenIds = liquidityProvider.getLpPositionsTokenIds();
        for (uint256 i = 0; i < tokenIds.length; i++) {
            liquidityProvider.redeemPosition(tokenIds[i]);
        }
        (
            address[] memory tokenAddresses,
            uint256[] memory balances
        ) = liquidityProvider.getTokenBalances();

        // Swap all ERC20 tokens to stable coin to return back to user
        for (uint256 i = 0; i < tokenAddresses.length; i++) {
            if (tokenAddresses[i] != address(stablecoin)) {
                swapTokens(tokenAddresses[i], address(stablecoin), balances[i]);
            }
        }
        totalStablecoinAfterUnwind = stablecoin.balanceOf(address(this));
    }

    function fetchAllLpPositions() public view returns (uint256[] memory) {
        return liquidityProvider.getLpPositionsTokenIds();
    }

    // Returns how much "stable" token the user has deposited
    // TODO: Make it dynamic with current yields from LP positions
    function getPortfolioByAddress(address _address)
        public
        view
        returns (uint256)
    {
        return depositedAmount[_address];
    }

    /**
     * deprecated
     */
    function borrowFromAave(address _underlyingAssetAddress, uint256 _amount)
        public
    {
        // get lending pool address (Ethereum mainnet)
        address lendingPoolAddress = LendingPoolAddressesProvider(
            0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
        ).getLendingPool();

        // borrow cryptoassets from lending pool - use stable interest rate
        ILendingPool(lendingPoolAddress).borrow(
            _underlyingAssetAddress,
            _amount,
            1,
            0,
            address(this)
        );
    }

    /**
     * deprecated
     */
    function repayToAave(address _underlyingAssetAddress, uint256 _amount)
        public
    {
        // get lending pool address (Ethereum mainnet)
        address lendingPoolAddress = LendingPoolAddressesProvider(
            0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
        ).getLendingPool();

        // allow lending pool to burn debt token
        IERC20Metadata(_underlyingAssetAddress).approve(
            lendingPoolAddress,
            _amount
        );

        // repay borrow amount
        ILendingPool(lendingPoolAddress).repay(
            _underlyingAssetAddress,
            _amount,
            1,
            address(this)
        );
    }

    function supplyToAave(address _underlyingAssetAddress, uint256 _amount)
        public
    {
        // get lending pool address (Ethereum mainnet)
        address lendingPoolAddress = LendingPoolAddressesProvider(
            0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
        ).getLendingPool();

        // approve the lending pool to transfer the underlying asset
        IERC20Metadata(_underlyingAssetAddress).approve(
            lendingPoolAddress,
            _amount
        );

        // this contract will receive the associated aToken
        ILendingPool(lendingPoolAddress).deposit(
            _underlyingAssetAddress,
            _amount,
            address(this),
            0
        );
    }

    function withdrawFromAave(address _underlyingAssetAddress, uint256 _amount)
        public
    {
        // get lending pool address (Ethereum mainnet)
        address lendingPoolAddress = LendingPoolAddressesProvider(
            0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
        ).getLendingPool();

        // this contract will receive the associated aToken
        ILendingPool(lendingPoolAddress).withdraw(
            _underlyingAssetAddress,
            _amount,
            address(this)
        );
    }
}
