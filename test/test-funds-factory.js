const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Funds Factory", function() {
    let assetManager;
    let fundsFactory;
    let uniswapAdapter;

    beforeEach(async function() {
        [assetManager] = await ethers.getSigners();

        const FundsFactory = await ethers.getContractFactory("FundsFactory");
        fundsFactory = await FundsFactory.deploy();

        const UniswapAdapter = await ethers.getContractFactory("Swap");
        // uniswap v3 router address passed as argument
        uniswapAdapter = await UniswapAdapter.deploy("0xE592427A0AEce92De3Edee1F18E0157C05861564");
    })
    
    it("Should be able to create a new funds", async function() {
        const stablecoinAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // USDC Ethereum mainnet address
        
        // timestamp
        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);
        const startDate = block.timestamp;
        const endDate = startDate + (3600 * 24 * 30);
          
        await fundsFactory.createNewFund(stablecoinAddress, startDate, endDate, uniswapAdapter.address);

        const fundsAddress = await fundsFactory.managerToFundsAddress(assetManager.address)

        // make sure that the start and mature date is initialized correctly
        const funds = await ethers.getContractAt("Funds", fundsAddress);
        expect(await funds.startDate()).to.equal(startDate);
        expect(await funds.matureDate()).to.equal(endDate);
    })
})