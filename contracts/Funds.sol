// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {LendingPoolAddressesProvider} from "./aave/ILendingPoolAddressesProvider.sol";
import {ILendingPool} from "./aave/ILendingPool.sol";
import {IFunds} from "./interfaces/IFunds.sol";
import {Swap} from "./uniswap/Swap.sol";
import {LiquidityProvider} from "./uniswap/LiquidityProvider.sol";

import {FundHasStarted, FundHasEnded, FundHasNotEnded, CallerIsNotFundManager} from "./interfaces/Errors.sol";

contract Funds is IFunds {
    IERC20Metadata public immutable stablecoin;

    Swap immutable swapAdapter;
    LiquidityProvider immutable liquidityProvider;

    uint256 public totalValueLocked;
    uint256 public startDate;
    uint256 public matureDate;
    uint256 public totalStablecoinAfterUnwind;

    // Owner of the fund
    address public fundManager;

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
        int24 upperTick,
        uint24 poolFee
    ) public _onlyFundManager {
        IERC20Metadata(token0).approve(address(liquidityProvider), amount0);
        IERC20Metadata(token1).approve(address(liquidityProvider), amount1);

        (uint256 tokenId, , , ) = liquidityProvider.mintPosition(
            token0,
            amount0,
            token1,
            amount1,
            lowerTick,
            upperTick,
            poolFee
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

    function increasePositionLiquidity(
        uint256 tokenId,
        uint256 amount0ToAdd,
        uint256 amount1ToAdd
    ) public {
        liquidityProvider.increasePositionLiquidity(
            tokenId,
            amount0ToAdd,
            amount1ToAdd,
            // Assumed to be "fund manager"
            msg.sender
        );
    }

    function decreasePositionLiquidity(
        uint256 tokenId,
        uint128 liquidityToRemove
    ) public {
        liquidityProvider.decreasePositionLiquidity(
            tokenId,
            liquidityToRemove,
            // Assumed to be "fund manager"
            msg.sender
        );
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
}
