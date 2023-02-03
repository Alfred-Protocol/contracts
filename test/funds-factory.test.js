const { expect } = require("chai");
const { ethers } = require("hardhat");
const { UNI_NFT_MANAGER, USDC_ADDRESS } = require("../constants/index");

describe("Funds Factory", function () {
	let assetManager;
	let fundsFactory;
	let uniswapAdapter, uniswapNftAdapter;

	beforeEach(async function () {
		[assetManager] = await ethers.getSigners();

		const UniswapAdapter = await ethers.getContractFactory("Swap");
		// uniswap v3 router address passed as argument
		uniswapAdapter = await UniswapAdapter.deploy(
			"0xE592427A0AEce92De3Edee1F18E0157C05861564"
		);

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

		const fundsAddress = await fundsFactory.managerToFundsAddress(
			assetManager.address
		);

		// make sure that the start and mature date is initialized correctly
		const funds = await ethers.getContractAt("Funds", fundsAddress);
		expect(await funds.startDate()).to.equal(startDate);
		expect(await funds.matureDate()).to.equal(endDate);
	});
});
