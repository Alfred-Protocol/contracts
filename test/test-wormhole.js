const { expect } = require("chai");
const fs = require('fs');
const { ethers } = require("hardhat");
const {CHAIN_ID_ETH, CHAIN_ID_AVAX, tryNativeToHexString} = require("@certusone/wormhole-sdk");
const { formatWormholeMessageFromReceipt } = require("../utils/helpers");
const { MockGuardians } = require("@certusone/wormhole-sdk/lib/cjs/mock");

describe("Wormhole Integration (ETH side)", function() {

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
        stablecoin = await ethers.getContractAt("IERC20Metadata", "0x07865c6E87B9F70255377e024ace6630C1Eaa37F");
    })
    
    it("Should be able to bridge USDC from ETH to AVAX", async function() {

        const stablecoinDecimals = await stablecoin.decimals();
        console.log("Stablecoin decimals: ", stablecoinDecimals);

        // get a USDC whale to transfer some USDC to the user (for mainnet forking test)
        const transferAmount = ethers.utils.parseUnits("100", stablecoinDecimals)
        await ethers.provider.send('hardhat_impersonateAccount', ['0x797c7ab9a2a29089b643e0b97d70fab7d2a07ddd']);
        const usdcWhale = await ethers.provider.getSigner('0x797c7ab9a2a29089b643e0b97d70fab7d2a07ddd');
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
        const json = JSON.stringify(receipt)
        fs.writeFile('output.json', json, (err) => {
            if (err) {
              console.error(err);
            } else {
              console.log('File saved successfully');
            }
        });
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

describe.only("Wormhold integration (AVAX side)", function() {

    let receipt;

    const AVAX_WORMHOLE_GUARDIAN_SET_INDEX = 3
    const GUARDIAN_PRIVATE_KEY = "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0"

    guardians = new MockGuardians(
        AVAX_WORMHOLE_GUARDIAN_SET_INDEX, 
        [GUARDIAN_PRIVATE_KEY]
    );

    fs.readFile('output.json', 'utf-8', (err, data) => {
        if (err) {
           console.error(err);
        } else {
           receipt = JSON.parse(data);
        }
    });

    it("Redeem USDC on AVAX", async function() {
        console.log("Receipt: ", receipt);
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

        // USDC stablecoin address (on Avax Fuji)
        stablecoin = await ethers.getContractAt("IERC20Metadata", "0x5425890298aed601595a70AB815c96711a31Bc65")

        // token contract on Fuji
        depositContract = await ethers.getContractAt("HelloToken", "0x6e1ef01273DbB1e99311bde7467512165f16DB78")

        const receiverStablecoinBalanceBefore = await stablecoin.balanceOf("0x02726D50CD200C195F3D1Cd5349Ca1B7f90D6BB5")
        await depositContract.redeemTransferWithPayload(
            signedTransferMessage
        )
        const receiverStablecoinBalanceAfter = await stablecoin.balanceOf("0x02726D50CD200C195F3D1Cd5349Ca1B7f90D6BB5");

        console.log("Stablecoin balance before: ", receiverStablecoinBalanceBefore);
        console.log("Stablecoin balance after: ", receiverStablecoinBalanceAfter);
    })
})