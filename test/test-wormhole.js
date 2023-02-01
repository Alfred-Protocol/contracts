const { expect } = require("chai");
const { ethers } = require("hardhat");
const {CHAIN_ID_ETH, CHAIN_ID_AVAX, tryNativeToHexString} = require("@certusone/wormhole-sdk");

describe("Wormhole Integration", function() {

    let depositContract;
    let stablecoin;
    let assetManager;

    beforeEach(async function() {
        [assetManager] = await ethers.getSigners();

        console.log("Chain ID AVAX: ", CHAIN_ID_AVAX);
        console.log("Chain ID ETH: ", CHAIN_ID_ETH);

        // Get wormhole contract
        depositContract = await ethers.getContractAt("HelloToken", "0x10219b965C8272245e3A08FBbB692539558FcaC8");

        // USDC stablecoin address (on Ethereum)
        stablecoin = await ethers.getContractAt("IERC20Metadata", "0x78deca24cba286c0f8d56370f5406b48cfce2f86");
    })
    
    it.only("Should be able to bridge USDC from AVAX to ETH", async function() {

        const stablecoinDecimals = await stablecoin.decimals();
        console.log("Stablecoin decimals: ", stablecoinDecimals);

        // get a USDC whale to transfer some USDC to the user (for mainnet forking test)
        const transferAmount = ethers.utils.parseUnits("100", stablecoinDecimals)
        await ethers.provider.send('hardhat_impersonateAccount', ['0xeeed1866e82808d6035372e4fd51455ea520e69a']);
        const usdcWhale = await ethers.provider.getSigner('0xeeed1866e82808d6035372e4fd51455ea520e69a');
        await stablecoin.connect(usdcWhale).transfer(assetManager.address, ethers.utils.parseUnits("10000", stablecoinDecimals));

        console.log("Stablecoin balance of asset manager: ", await stablecoin.balanceOf(assetManager.address));

        // recipient address on avax
        const avaxAddress = "0x02726D50CD200C195F3D1Cd5349Ca1B7f90D6BB5";

        console.log("Chain ID AVAX: ", CHAIN_ID_AVAX);
        console.log("Chain ID ETH: ", CHAIN_ID_ETH);

        await stablecoin.approve(depositContract.address, transferAmount);
        await depositContract.sendTokensWithPayload(
            stablecoin.address,
            transferAmount,
            CHAIN_ID_AVAX, // targetChainId
            0, // batchId=0 to opt out of batching
            "0x" + tryNativeToHexString(avaxAddress, CHAIN_ID_AVAX)
        )  
    })
})