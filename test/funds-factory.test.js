const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
	UNI_NFT_MANAGER,
	USDC_ADDRESS,
	UNI_SWAP_ROUTER_ADDRESS,
} = require("../constants/index");

describe("Funds Factory", function () {
	let assetManager;
	let fundsFactory;
	let uniswapAdapter, uniswapNftAdapter;

	beforeEach(async function () {
		[assetManager] = await ethers.getSigners();

		const UniswapAdapter = await ethers.getContractFactory("Swap");
		// uniswap v3 router address passed as argument
		uniswapAdapter = await UniswapAdapter.deploy(UNI_SWAP_ROUTER_ADDRESS);

		const UniswapNftAdapter = await ethers.getContractFactory(
			"LiquidityProvider"
		);
		uniswapNftAdapter = await UniswapNftAdapter.deploy(UNI_NFT_MANAGER);

		const FundsFactory = await ethers.getContractFactory("FundsFactory");
		fundsFactory = await FundsFactory.deploy(
			uniswapAdapter.address,
			uniswapNftAdapter.address
		);
	});

	it("Should be able to create a new funds", async function () {
		const stablecoinAddress = USDC_ADDRESS; // USDC Ethereum mainnet address
		// timestamp
		const blockNumber = await ethers.provider.getBlockNumber();
		const block = await ethers.provider.getBlock(blockNumber);
		const startDate = block.timestamp;
		const endDate = startDate + 3600 * 24 * 30;

		await fundsFactory
			.connect(assetManager)
			.createNewFund(stablecoinAddress, startDate, endDate);

		const fundsAddresses = await fundsFactory.getFundsByManager(
			assetManager.address
		);

		expect(fundsAddresses.length).to.be.gt(0);

		// make sure that the start and mature date is initialized correctly
		const funds = await ethers.getContractAt("Funds", fundsAddresses[0]);
		expect(await funds.startDate()).to.equal(startDate);
		expect(await funds.matureDate()).to.equal(endDate);
	});

	it("Should be able to create multiple new funds", async function () {
		const stablecoinAddress = USDC_ADDRESS; // USDC Ethereum mainnet address

		// timestamp
		const blockNumber = await ethers.provider.getBlockNumber();
		const block = await ethers.provider.getBlock(blockNumber);
		const startDate = block.timestamp;

		// Extra month
		const endDate = startDate + 3600 * 24 * 30;

		await fundsFactory
			.connect(assetManager)
			.createNewFund(stablecoinAddress, startDate, endDate);

		await fundsFactory
			.connect(assetManager)
			.createNewFund(stablecoinAddress, endDate, endDate + 3600 * 24 * 30);

		const fundsAddresses = await fundsFactory.getFundsByManager(
			assetManager.address
		);

		expect(fundsAddresses.length).to.equal(2);

		// make sure that the start and mature date is initialized correctly
		const firstFunds = await ethers.getContractAt("Funds", fundsAddresses[0]);
		expect(await firstFunds.startDate()).to.equal(startDate);
		expect(await firstFunds.matureDate()).to.equal(endDate);

		const secondFunds = await ethers.getContractAt("Funds", fundsAddresses[1]);
		expect(await secondFunds.startDate()).to.equal(endDate);
		expect(await secondFunds.matureDate()).to.equal(endDate + 3600 * 24 * 30);
	});
});
