// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/base/LiquidityManagement.sol";

contract LiquidityProvider is IERC721Receiver {
    int24 private constant MIN_TICK = -887272;
    int24 private constant MAX_TICK = -MIN_TICK;
    int24 private constant TICK_SPACING = 60;

    INonfungiblePositionManager public immutable nftPositionsManager;

    // 0.3% fee
    uint24 public constant poolFee = 3000;

    // LP position
    struct Deposit {
        address owner;
        uint128 liquidity;
        address token0;
        address token1;
    }

    // Map "tokenId" to "Deposit"
    mapping(uint256 => Deposit) public deposits;

    constructor(address _nftPositionsManager) {
        nftPositionsManager = INonfungiblePositionManager(_nftPositionsManager);
    }

    function _createDeposit(address owner, uint256 tokenId) internal {
      // https://docs.uniswap.org/contracts/v3/reference/periphery/interfaces/INonfungiblePositionManager
      (
          ,
          ,
          address token0,
          address token1,
          ,
          ,
          ,
          uint128 liquidity,
          ,
          ,
          ,
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
      address,
      uint256 tokenId,
      bytes calldata
  ) external override returns (bytes4) {
      _createDeposit(operator, tokenId);

      return this.onERC721Received.selector;
  }
  
  function mintPosition(
      address token0,
      uint256 amount0ToMint,
      address token1,
      uint256 amount1ToMint,
      int24 lowerTick,
      int24 upperTick
  )
      external
      returns (
          uint256 tokenId,
          uint128 liquidity,
          uint256 amount0,
          uint256 amount1
      )
  {
      TransferHelper.safeTransferFrom(token0, msg.sender, address(this), amount0ToMint);
      TransferHelper.safeTransferFrom(token1, msg.sender, address(this), amount1ToMint);

      TransferHelper.safeApprove(token0, address(nftPositionsManager), amount0ToMint);
      TransferHelper.safeApprove(token1, address(nftPositionsManager), amount1ToMint);

      // Mint position
      INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
          token0: token0,
          token1: token1,
          fee: poolFee,
          // Customize tickLower & tickUpper to optimize swap fees, depending on LP strategy
          tickLower: (MIN_TICK / TICK_SPACING) * TICK_SPACING,
          tickUpper: (MAX_TICK / TICK_SPACING) * TICK_SPACING,
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
          TransferHelper.safeApprove(token0, address(nftPositionsManager), amount0);
          TransferHelper.safeTransfer(
              token0,
              msg.sender,
              amount0ToMint - amount0
          );
      }

      if (amount1 < amount1ToMint) {
          TransferHelper.safeApprove(token1, address(nftPositionsManager), amount1);
          TransferHelper.safeTransfer(
              token1,
              msg.sender,
              amount1ToMint - amount1
          );
      }
  }

  function redeemPosition(uint256 tokenId)
      external
      returns (uint256 amount0, uint256 amount1)
  {
      require(deposits[tokenId].owner == msg.sender, "Not owner of position");

      // Transfer NFT to this contract, msg.sender must havbe ownership of NFT
      nftPositionsManager.safeTransferFrom(
          msg.sender,
          address(this),
          tokenId
      );

      (amount0, amount1) = nftPositionsManager.collect(
          INonfungiblePositionManager.CollectParams({
              tokenId: tokenId,
              recipient: msg.sender,
              amount0Max: type(uint128).max,
              amount1Max: type(uint128).max
          })
      );
      _sendToOwner(tokenId, amount0, amount1);

      return (amount0, amount1);
  }

  function _sendToOwner(
      uint256 tokenId,
      uint256 amount0,
      uint256 amount1
  ) internal {
      Deposit memory deposit = deposits[tokenId];
      // Transfer token0 to owner
      TransferHelper.safeTransfer(deposit.token0, deposit.owner, amount0);
      // Transfer token1 to owner
      TransferHelper.safeTransfer(deposit.token1, deposit.owner, amount1);
  }
}
