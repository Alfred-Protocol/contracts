const { expect } = require("chai");
const { ethers } = require("hardhat");
const {CHAIN_ID_ETH, CHAIN_ID_AVAX, tryNativeToHexString} = require("@certusone/wormhole-sdk");
const { formatWormholeMessageFromReceipt } = require("../utils/helpers");
const { MockGuardians } = require("@certusone/wormhole-sdk/lib/cjs/mock");

describe("Wormhole Integration", function() {

    let depositContract;
    let stablecoin;
    let assetManager;
    let guardians;

    beforeEach(async function() {
        [assetManager] = await ethers.getSigners();

        const AVAX_WORMHOLE_GUARDIAN_SET_INDEX = 3
        const GUARDIAN_PRIVATE_KEY = "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0"

        guardians = new MockGuardians(
            AVAX_WORMHOLE_GUARDIAN_SET_INDEX, 
            [GUARDIAN_PRIVATE_KEY]
        );

        console.log("Chain ID AVAX: ", CHAIN_ID_AVAX);
        console.log("Chain ID ETH: ", CHAIN_ID_ETH);

        // Get wormhole contract
        depositContract = await ethers.getContractAt("HelloToken", "0x10219b965C8272245e3A08FBbB692539558FcaC8");

        // USDC stablecoin address (on Ethereum)
        stablecoin = await ethers.getContractAt("IERC20Metadata", "0x78deca24cba286c0f8d56370f5406b48cfce2f86");
    })
    
    it.only("Should be able to bridge USDC from ETH to AVAX", async function() {

        const stablecoinDecimals = await stablecoin.decimals();
        console.log("Stablecoin decimals: ", stablecoinDecimals);

        // get a USDC whale to transfer some USDC to the user (for mainnet forking test)
        const transferAmount = ethers.utils.parseUnits("100", stablecoinDecimals)
        await ethers.provider.send('hardhat_impersonateAccount', ['0xeeed1866e82808d6035372e4fd51455ea520e69a']);
        const usdcWhale = await ethers.provider.getSigner('0xeeed1866e82808d6035372e4fd51455ea520e69a');
        await stablecoin.connect(usdcWhale).transfer(assetManager.address, ethers.utils.parseUnits("10000", stablecoinDecimals));

        const senderStablcoinBalanceBefore = await stablecoin.balanceOf(assetManager.address);

        // recipient address on avax
        const avaxAddress = "0x02726D50CD200C195F3D1Cd5349Ca1B7f90D6BB5";

        console.log("Chain ID AVAX: ", CHAIN_ID_AVAX);
        console.log("Chain ID ETH: ", CHAIN_ID_ETH);

        await stablecoin.approve(depositContract.address, transferAmount);
        const tx = await depositContract.sendTokensWithPayload(
            stablecoin.address,
            transferAmount,
            CHAIN_ID_AVAX, // targetChainId
            0, // batchId=0 to opt out of batching
            "0x" + tryNativeToHexString(avaxAddress, CHAIN_ID_AVAX)
        )
        const receipt = await tx.wait()
        //console.log("Transaction receipt: ", receipt);

        const senderStablcoinBalanceAfter = await stablecoin.balanceOf(assetManager.address);
        expect(senderStablcoinBalanceBefore.sub(senderStablcoinBalanceAfter)).to.equal(transferAmount);

        // now grab the Wormhole message
        const unsignedMessages = await formatWormholeMessageFromReceipt(
            receipt,
            CHAIN_ID_ETH
        );
        expect(unsignedMessages.length).to.equal(1);

        // sign the TransferWithPayload message
        const signedTransferMessage = Uint8Array.from(
            guardians.addSignatures(unsignedMessages[0], [0])
        );

        console.log("Signed messages: ", signedTransferMessage)

    })
})