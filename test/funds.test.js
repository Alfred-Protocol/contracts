const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
	UNI_NFT_MANAGER,
	WETH_ADDRESS,
	USDC_ADDRESS,
	UNI_SWAP_ROUTER_ADDRESS,
} = require("../constants/index");

describe("Funds", function () {
	let assetManager, user;
	let fundsFactory;
	let uniswapAdapter, uniswapNftAdapter;
	let funds;
	let stablecoin, stablecoinDecimals, stablecoinAddress;

	beforeEach(async function () {
		[assetManager, user] = await ethers.getSigners();

		const UniswapAdapter = await ethers.getContractFactory("Swap");
		// uniswap v3 router address passed as argument
		uniswapAdapter = await UniswapAdapter.deploy(UNI_SWAP_ROUTER_ADDRESS);

		// Handle minting & burning of NFT LP positions
		const UniswapNftAdapter = await ethers.getContractFactory(
			"LiquidityProvider"
		);
		uniswapNftAdapter = await UniswapNftAdapter.deploy(UNI_NFT_MANAGER);

		const FundsFactory = await ethers.getContractFactory("FundsFactory");
		fundsFactory = await FundsFactory.deploy(
			uniswapAdapter.address,
			uniswapNftAdapter.address
		);

		stablecoinAddress = USDC_ADDRESS; // USDC Ethereum mainnet address
		stablecoin = await ethers.getContractAt(
			"IERC20Metadata",
			stablecoinAddress
		);
		stablecoinDecimals = await stablecoin.decimals();

		// timestamp
		const blockNumber = await ethers.provider.getBlockNumber();
		const block = await ethers.provider.getBlock(blockNumber);
		const startDate = block.timestamp + 3600 * 24 * 30;
		const endDate = startDate + 3600 * 24 * 30;

		await fundsFactory
			.connect(assetManager)
			.createNewFund(stablecoinAddress, startDate, endDate);

		const fundsAddresses = await fundsFactory.getFundsByManager(
			await assetManager.getAddress()
		);

		expect(fundsAddresses.length).to.equal(1);

		const fundsAddress = fundsAddresses[0];

		// deploy a new fund instance
		funds = await ethers.getContractAt("Funds", fundsAddress);

		// get a USDC whale to transfer some USDC to the user (for mainnet forking test)
		await ethers.provider.send("hardhat_impersonateAccount", [
			"0xda9ce944a37d218c3302f6b82a094844c6eceb17",
		]);
		const usdcWhale = ethers.provider.getSigner(
			"0xda9ce944a37d218c3302f6b82a094844c6eceb17"
		);
		await stablecoin
			.connect(usdcWhale)
			.transfer(
				await user.getAddress(),
				ethers.utils.parseUnits("10000", stablecoinDecimals)
			);
	});

	it("User should be able to deposit stablecoin", async function () {
		const depositAmount = ethers.utils.parseUnits("1000", stablecoinDecimals);
		const stablecoinBalanceBefore = await stablecoin.balanceOf(user.address);
		await depositToFundsContract(stablecoin, funds, user, depositAmount);
		const stablecoinBalanceAfter = await stablecoin.balanceOf(user.address);

		expect(await funds.totalValueLocked()).to.equal(depositAmount);
		expect(await funds.depositedAmount(user.address)).to.equal(depositAmount);
		expect(stablecoinBalanceBefore.sub(stablecoinBalanceAfter)).to.equal(
			depositAmount
		);
	});

	it("User should deposit & swap", async function () {
		const depositAmount = ethers.utils.parseUnits("1000", stablecoinDecimals);
		const stablecoinBalanceBefore = await stablecoin.balanceOf(user.address);
		await depositToFundsContract(stablecoin, funds, user, depositAmount);
		const stablecoinBalanceAfter = await stablecoin.balanceOf(user.address);

		expect(await funds.totalValueLocked()).to.equal(depositAmount);
		expect(await funds.depositedAmount(user.address)).to.equal(depositAmount);
		expect(stablecoinBalanceBefore.sub(stablecoinBalanceAfter)).to.equal(
			depositAmount
		);

		const wethToken = await ethers.getContractAt("IERC20", WETH_ADDRESS);
		const usdcToken = await ethers.getContractAt("IERC20", USDC_ADDRESS);

		// swap USDC to WETH
		usdcToken
			.connect(assetManager)
			.approve(funds.address, ethers.constants.MaxUint256);

		await funds
			.connect(assetManager)
			.swapTokens(
				USDC_ADDRESS,
				WETH_ADDRESS,
				ethers.utils.parseUnits("1000", stablecoinDecimals)
			);

		const wethBalance = await wethToken.balanceOf(funds.address);
		expect(wethBalance).to.be.gt(ethers.utils.parseUnits("0"));
	});

	it("User should deposit, swap & LP", async function () {
		const depositAmount = ethers.utils.parseUnits("1000", stablecoinDecimals);
		const stablecoinBalanceBefore = await stablecoin.balanceOf(user.address);
		await depositToFundsContract(stablecoin, funds, user, depositAmount);
		const stablecoinBalanceAfter = await stablecoin.balanceOf(user.address);

		expect(await funds.totalValueLocked()).to.equal(depositAmount);
		expect(await funds.depositedAmount(user.address)).to.equal(depositAmount);
		expect(stablecoinBalanceBefore.sub(stablecoinBalanceAfter)).to.equal(
			depositAmount
		);

		const wethToken = await ethers.getContractAt("IERC20", WETH_ADDRESS);
		const usdcToken = await ethers.getContractAt("IERC20", USDC_ADDRESS);

		// swap USDC to WETH
		usdcToken
			.connect(assetManager)
			.approve(funds.address, ethers.constants.MaxUint256);

		await funds
			.connect(assetManager)
			.swapTokens(
				USDC_ADDRESS,
				WETH_ADDRESS,
				ethers.utils.parseUnits("500", stablecoinDecimals)
			);

		const wethBalance = await wethToken.balanceOf(funds.address);
		expect(wethBalance).to.be.gt(ethers.utils.parseUnits("0"));

		// add liquidity
		usdcToken
			.connect(assetManager)
			.approve(funds.address, ethers.constants.MaxUint256);

		wethToken
			.connect(assetManager)
			.approve(funds.address, ethers.constants.MaxUint256);

		await funds.createLpPosition(
			USDC_ADDRESS,
			WETH_ADDRESS,
			ethers.utils.parseUnits("500", stablecoinDecimals),
			ethers.utils.parseUnits("0.25", 18),
			0,
			0
		);
	});

	it("User should deposit, swap, LP & burn", async function () {
		const depositAmount = ethers.utils.parseUnits("1000", stablecoinDecimals);
		const stablecoinBalanceBefore = await stablecoin.balanceOf(user.address);
		await depositToFundsContract(stablecoin, funds, user, depositAmount);
		const stablecoinBalanceAfter = await stablecoin.balanceOf(user.address);

		expect(await funds.totalValueLocked()).to.equal(depositAmount);
		expect(await funds.depositedAmount(user.address)).to.equal(depositAmount);
		expect(stablecoinBalanceBefore.sub(stablecoinBalanceAfter)).to.equal(
			depositAmount
		);

		const wethToken = await ethers.getContractAt("IERC20", WETH_ADDRESS);
		const usdcToken = await ethers.getContractAt("IERC20", USDC_ADDRESS);

		// swap USDC to WETH
		usdcToken
			.connect(assetManager)
			.approve(funds.address, ethers.constants.MaxUint256);

		await funds
			.connect(assetManager)
			.swapTokens(
				USDC_ADDRESS,
				WETH_ADDRESS,
				ethers.utils.parseUnits("500", stablecoinDecimals)
			);

		const wethBalance = await wethToken.balanceOf(funds.address);
		expect(wethBalance).to.be.gt(ethers.utils.parseUnits("0"));

		// add liquidity
		usdcToken
			.connect(assetManager)
			.approve(funds.address, ethers.constants.MaxUint256);

		wethToken
			.connect(assetManager)
			.approve(funds.address, ethers.constants.MaxUint256);

		const tx = await funds.createLpPosition(
			USDC_ADDRESS,
			WETH_ADDRESS,
			ethers.utils.parseUnits("500", stablecoinDecimals),
			ethers.utils.parseUnits("0.25", 18),
			0,
			0
		);

		const receipt = await tx.wait();

		const positionMintedEvent = receipt.events?.filter((x) => {
			return x?.event == "PositionMinted";
		});

		expect(positionMintedEvent).to.be.not.null;
		const tokenId = positionMintedEvent[0]?.args?.tokenId;

		// Burn position
		await funds.connect(assetManager).redeemLpPosition(tokenId);
	});
});

async function depositToFundsContract(stablecoin, funds, user, depositAmount) {
	await stablecoin.connect(user).approve(funds.address, depositAmount);
	await funds.connect(user).deposit(depositAmount);
}
