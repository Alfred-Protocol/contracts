const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { UNI_NFT_MANAGER } = require("../constants/index");

const stablecoinDecimals = 6;
const ethDecimals = 18;

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

// https://www.whalestats.com/analysis-of-the-top-100-eth-wallets
const USDC_WHALE = "0x6555e1CC97d3cbA6eAddebBCD7Ca51d75771e0B8";
const WETH_WHALE = "0x6555e1CC97d3cbA6eAddebBCD7Ca51d75771e0B8";

const UNI_SWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

const MIN_TICK = -887272;
const MAX_TICK = -MIN_TICK;

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
				MIN_TICK,
				MAX_TICK
			);
	});

	it("Should mint & burn LP position", async () => {
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
				MIN_TICK,
				MAX_TICK
			);

		const receipt = await tx.wait();

		const positionMintedEvent = receipt.events?.filter((x) => {
			return x?.event == "PositionMinted";
		});

		expect(positionMintedEvent).to.be.not.null;
		const tokenId = positionMintedEvent[0].args.tokenId;

		// Burn position
		await uniswapLp.connect(addr1).redeemPosition(tokenId);
	});
});
