const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const {
	UNI_NFT_MANAGER,
	WETH_ADDRESS,
	USDC_ADDRESS,
} = require("../constants/index");

const stablecoinDecimals = 6;
const ethDecimals = 18;

const POOL_FEE = 3000;

// https://www.whalestats.com/analysis-of-the-top-100-eth-wallets
const USDC_WHALE = "0x6555e1CC97d3cbA6eAddebBCD7Ca51d75771e0B8";
const WETH_WHALE = "0x6555e1CC97d3cbA6eAddebBCD7Ca51d75771e0B8";

const UNI_SWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

describe("Uniswap", () => {
	let addr1;

	let uniswap, uniswapLp;

	let usdc, weth;
	let usdcWhale, wethWhale;

	beforeEach(async () => {
		[addr1] = await ethers.getSigners();

		const swapContractFactory = await ethers.getContractFactory("Swap");
		uniswap = await swapContractFactory.deploy(UNI_SWAP_ROUTER);
		await uniswap.deployed();

		const lpContractFactory = await ethers.getContractFactory(
			"LiquidityProvider"
		);
		uniswapLp = await lpContractFactory.deploy(UNI_NFT_MANAGER);
		await uniswapLp.deployed();

		usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
		weth = await ethers.getContractAt("IERC20", WETH_ADDRESS);

		// Unlock whales
		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [USDC_WHALE],
		});

		await network.provider.request({
			method: "hardhat_impersonateAccount",
			params: [WETH_WHALE],
		});

		// Control whales
		usdcWhale = await ethers.getSigner(USDC_WHALE);
		wethWhale = await ethers.getSigner(WETH_WHALE);
	});

	it("Should swap USDC -> WETH", async () => {
		const receiver = await addr1.getAddress();
		const amountIn = ethers.utils.parseUnits("1000", stablecoinDecimals);

		await usdc.connect(usdcWhale).transfer(receiver, amountIn);
		await usdc.connect(addr1).approve(uniswap.address, amountIn);

		await uniswap.swap(USDC_ADDRESS, WETH_ADDRESS, amountIn);
		const wethBalance = await weth.balanceOf(addr1.address);

		expect(wethBalance, "Amount out is not more than 0").to.be.gt(0);
	});

	it("Should mint LP position", async () => {
		const receiver = await addr1.getAddress();
		const usdcAmount = ethers.utils.parseUnits("2000", stablecoinDecimals);
		const wethAmount = ethers.utils.parseUnits("1", ethDecimals);

		// Transfer USDC and WETH to receiver
		await usdc.connect(usdcWhale).transfer(receiver, usdcAmount);
		await weth.connect(wethWhale).transfer(addr1.address, wethAmount);

		// Approve
		await usdc.connect(addr1).approve(uniswapLp.address, usdcAmount);
		await weth.connect(addr1).approve(uniswapLp.address, wethAmount);

		await uniswapLp
			.connect(addr1)
			.mintPosition(
				USDC_ADDRESS,
				usdcAmount,
				WETH_ADDRESS,
				wethAmount,
				0,
				0,
				POOL_FEE
			);

		const tokenIds = await uniswapLp.connect(addr1).getLpPositionsTokenIds();
		expect(tokenIds.length).to.be.gt(0);
	});

	it("Should mint LP position & increase liquidity", async () => {
		const receiver = await addr1.getAddress();
		const usdcAmount = ethers.utils.parseUnits("2000", stablecoinDecimals);
		const wethAmount = ethers.utils.parseUnits("1", ethDecimals);

		// Transfer USDC and WETH to receiver
		await usdc.connect(usdcWhale).transfer(receiver, usdcAmount);
		await weth.connect(wethWhale).transfer(addr1.address, wethAmount);

		// Approve
		await usdc.connect(addr1).approve(uniswapLp.address, usdcAmount);
		await weth.connect(addr1).approve(uniswapLp.address, wethAmount);

		const tx = await uniswapLp
			.connect(addr1)
			.mintPosition(
				USDC_ADDRESS,
				usdcAmount,
				WETH_ADDRESS,
				wethAmount,
				0,
				0,
				POOL_FEE
			);

		const receipt = await tx.wait();

		const positionMintedEvent = receipt.events?.filter((x) => {
			return x?.event == "PositionMinted";
		});

		expect(positionMintedEvent).to.be.not.null;
		const tokenId = positionMintedEvent[0].args.tokenId;

		// Increase liquidity
		const usdcAmountToIncrease = ethers.utils.parseUnits(
			"1000",
			stablecoinDecimals
		);
		const wethAmountToIncrease = ethers.utils.parseUnits("0.5", ethDecimals);

		await usdc.connect(usdcWhale).transfer(receiver, usdcAmountToIncrease);
		await weth.connect(wethWhale).transfer(receiver, wethAmountToIncrease);

		// Approve
		await usdc
			.connect(addr1)
			.approve(uniswapLp.address, usdcAmount + usdcAmountToIncrease);
		await weth
			.connect(addr1)
			.approve(uniswapLp.address, wethAmount + wethAmountToIncrease);

		await uniswapLp
			.connect(addr1)
			.increasePositionLiquidity(
				tokenId,
				usdcAmountToIncrease,
				wethAmountToIncrease,
				addr1.address
			);

		const tokenIds = await uniswapLp.connect(addr1).getLpPositionsTokenIds();
		expect(tokenIds.length).to.be.gt(0);

		const activeLpPositions = await uniswapLp
			.connect(addr1)
			.getActiveLpPositions();
		expect(activeLpPositions.length).to.be.gt(0);
	});

	it("Should mint LP position, increase & decrease liquidity", async () => {
		const receiver = await addr1.getAddress();
		const usdcAmount = ethers.utils.parseUnits("2000", stablecoinDecimals);
		const wethAmount = ethers.utils.parseUnits("1", ethDecimals);

		// Transfer USDC and WETH to receiver
		await usdc.connect(usdcWhale).transfer(receiver, usdcAmount);
		await weth.connect(wethWhale).transfer(addr1.address, wethAmount);

		// Approve
		await usdc.connect(addr1).approve(uniswapLp.address, usdcAmount);
		await weth.connect(addr1).approve(uniswapLp.address, wethAmount);

		const tx = await uniswapLp
			.connect(addr1)
			.mintPosition(
				USDC_ADDRESS,
				usdcAmount,
				WETH_ADDRESS,
				wethAmount,
				0,
				0,
				POOL_FEE
			);

		const receipt = await tx.wait();

		const positionMintedEvent = receipt.events?.filter((x) => {
			return x?.event == "PositionMinted";
		});

		expect(positionMintedEvent).to.be.not.null;
		const tokenId = positionMintedEvent[0].args.tokenId;

		// Increase liquidity
		const usdcAmountToIncrease = ethers.utils.parseUnits(
			"1000",
			stablecoinDecimals
		);
		const wethAmountToIncrease = ethers.utils.parseUnits("0.5", ethDecimals);

		await usdc.connect(usdcWhale).transfer(receiver, usdcAmountToIncrease);
		await weth.connect(wethWhale).transfer(receiver, wethAmountToIncrease);

		// Approve
		await usdc
			.connect(addr1)
			.approve(uniswapLp.address, usdcAmount + usdcAmountToIncrease);
		await weth
			.connect(addr1)
			.approve(uniswapLp.address, wethAmount + wethAmountToIncrease);

		await uniswapLp
			.connect(addr1)
			.increasePositionLiquidity(
				tokenId,
				usdcAmountToIncrease,
				wethAmountToIncrease,
				addr1.address
			);

		const liquidityToDecrease = ethers.utils.parseUnits(
			"1000",
			stablecoinDecimals
		);

		const tokenIdToLpPositions = await uniswapLp.connect(addr1)
			.tokenIdToLpPositions;

		const lpPosition = await tokenIdToLpPositions(tokenId);
		const prevLiquidity = lpPosition.liquidity;

		const tx1 = await uniswapLp
			.connect(addr1)
			.decreasePositionLiquidity(tokenId, liquidityToDecrease, addr1.address);

		const receipt1 = await tx1.wait();

		const positionLiquidityDecreased = receipt1.events?.filter((x) => {
			return x?.event == "PositionLiquidityModified";
		});

		expect(positionLiquidityDecreased).to.be.not.null;
		const liquidityEvent = positionLiquidityDecreased[0].args.liquidity;

		// Check if liquidity is correct
		expect(liquidityEvent).to.be.eq(prevLiquidity.sub(liquidityToDecrease));

		const tokenIds = await uniswapLp.connect(addr1).getLpPositionsTokenIds();
		expect(tokenIds.length).to.be.gt(0);

		const activeLpPositions = await uniswapLp
			.connect(addr1)
			.getActiveLpPositions();
		expect(activeLpPositions.length).to.be.gt(0);
		console.log(activeLpPositions);
	});

	it("Should mint & collect LP fees", async () => {
		const receiver = await addr1.getAddress();
		const usdcAmount = ethers.utils.parseUnits("2000", stablecoinDecimals);
		const wethAmount = ethers.utils.parseUnits("1", ethDecimals);

		// Transfer USDC and WETH to receiver
		await usdc.connect(usdcWhale).transfer(receiver, usdcAmount);
		await weth.connect(wethWhale).transfer(addr1.address, wethAmount);

		// Approve
		await usdc.connect(addr1).approve(uniswapLp.address, usdcAmount);
		await weth.connect(addr1).approve(uniswapLp.address, wethAmount);

		const tx = await uniswapLp
			.connect(addr1)
			.mintPosition(
				USDC_ADDRESS,
				usdcAmount,
				WETH_ADDRESS,
				wethAmount,
				0,
				0,
				POOL_FEE
			);

		const receipt = await tx.wait();

		const positionMintedEvent = receipt.events?.filter((x) => {
			return x?.event == "PositionMinted";
		});

		expect(positionMintedEvent).to.be.not.null;
		const tokenId = positionMintedEvent[0].args.tokenId;

		await uniswapLp.connect(addr1).collectFees(tokenId);
	});

	it("Should mint, decrease liquidity & burn LP position", async () => {
		const receiver = await addr1.getAddress();
		const usdcAmount = ethers.utils.parseUnits("2000", stablecoinDecimals);
		const wethAmount = ethers.utils.parseUnits("1", ethDecimals);

		// Transfer USDC and WETH to receiver
		await usdc.connect(usdcWhale).transfer(receiver, usdcAmount);
		await weth.connect(wethWhale).transfer(addr1.address, wethAmount);

		// Approve
		await usdc.connect(addr1).approve(uniswapLp.address, usdcAmount);
		await weth.connect(addr1).approve(uniswapLp.address, wethAmount);

		const tx = await uniswapLp
			.connect(addr1)
			.mintPosition(
				USDC_ADDRESS,
				usdcAmount,
				WETH_ADDRESS,
				wethAmount,
				0,
				0,
				POOL_FEE
			);

		const receipt = await tx.wait();

		const positionMintedEvent = receipt.events?.filter((x) => {
			return x?.event == "PositionMinted";
		});

		expect(positionMintedEvent).to.be.not.null;
		const tokenId = positionMintedEvent[0].args.tokenId;
		const liquidity = positionMintedEvent[0].args.liquidity;

		await uniswapLp
			.connect(addr1)
			.decreasePositionLiquidity(tokenId, liquidity, addr1.address);
		await uniswapLp.connect(addr1).collectFees(tokenId);

		await uniswapLp.connect(addr1).burnPosition(tokenId);
	});
});

/**
 * 2. Review "functions" to see what can be removed and what can be added
 * 4. Look into hard-coded TICK_SPACINGS
 * 5. Write tests for "unwinding" all positions in fund
 */
