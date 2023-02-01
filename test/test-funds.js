const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Funds Factory", function() {
    let assetManager, user;
    let fundsFactory;
    let uniswapAdapter;
    let funds;
    let stablecoin, stablecoinDecimals, stablecoinAddress;

    beforeEach(async function() {
        [assetManager, user] = await ethers.getSigners();

        const FundsFactory = await ethers.getContractFactory("FundsFactory");
        fundsFactory = await FundsFactory.deploy();

        const UniswapAdapter = await ethers.getContractFactory("Swap");
        // uniswap v3 router address passed as argument
        uniswapAdapter = await UniswapAdapter.deploy("0xE592427A0AEce92De3Edee1F18E0157C05861564");

        stablecoinAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // USDC Ethereum mainnet address
        stablecoin = await ethers.getContractAt("IERC20Metadata", stablecoinAddress);
        stablecoinDecimals = await stablecoin.decimals();
        
        // timestamp
        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);
        const startDate = block.timestamp + (3600 * 24 * 30);
        const endDate = startDate + (3600 * 24 * 30);
          
        await fundsFactory.createNewFund(stablecoinAddress, startDate, endDate, uniswapAdapter.address);

        const fundsAddress = await fundsFactory.managerToFundsAddress(assetManager.address)

        // deploy a new fund instance
        funds = await ethers.getContractAt("Funds", fundsAddress);

        // get a USDC whale to transfer some USDC to the user (for mainnet forking test)
        await ethers.provider.send('hardhat_impersonateAccount', ['0xda9ce944a37d218c3302f6b82a094844c6eceb17']);
        const usdcWhale = await ethers.provider.getSigner('0xda9ce944a37d218c3302f6b82a094844c6eceb17');
        await stablecoin.connect(usdcWhale).transfer(user.address, ethers.utils.parseUnits("10000", stablecoinDecimals));
    })
    
    it("User should be able to deposit stablecoin", async function() {
        const depositAmount = ethers.utils.parseUnits("1000", stablecoinDecimals);
        const stablecoinBalanceBefore = await stablecoin.balanceOf(user.address);
        await depositToFundsContract(stablecoin, funds, user, depositAmount);
        const stablecoinBalanceAfter = await stablecoin.balanceOf(user.address);

        expect(await funds.totalValueLocked()).to.equal(depositAmount);
        expect(await funds.depositedAmount(user.address)).to.equal(depositAmount);
        expect(stablecoinBalanceBefore.sub(stablecoinBalanceAfter)).to.equal(depositAmount);
    })

    it("Asset manager should be able to supply and borrow from Aave", async function() {
        const depositAmount = ethers.utils.parseUnits("1000", stablecoinDecimals);
        await depositToFundsContract(stablecoin, funds, user, depositAmount);

        // supply USDC to aave
        await funds.connect(assetManager).supplyToAave(stablecoinAddress, depositAmount);

        // aToken of USDC
        const usdcAToken = await ethers.getContractAt("IERC20Metadata", "0xBcca60bB61934080951369a648Fb03DF4F96263C");
        // funds contract should accumulate equal amount of usdc aToken
        expect(await usdcAToken.balanceOf(funds.address)).to.equal(depositAmount);

        const fraxAddress = "0x853d955acef822db058eb8505911ed77f175b99e"
        await funds.borrowFromAave(fraxAddress, ethers.utils.parseEther("5"));

        // debt token of FRAX
        const fraxDebtToken = await ethers.getContractAt("IERC20Metadata", "0x3916e3B6c84b161df1b2733dFfc9569a1dA710c2");
        // funds contract should accumulate equal amount of aave debt token
        console.log(await fraxDebtToken.balanceOf(funds.address))
    })
})

async function depositToFundsContract(stablecoin, funds, user, depositAmount) {
    await stablecoin.connect(user).approve(funds.address, depositAmount);
    await funds.connect(user).deposit(depositAmount);
}