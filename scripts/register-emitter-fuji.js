// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");
const { tryNativeToHexString } = require("@certusone/wormhole-sdk");

async function main() {

  // get wormhole contract on fuji and register emitter on ethereum address
  const CHAIN_ID_ETH = 2
  const depositContract = await ethers.getContractAt("HelloToken", "0x6e1ef01273DbB1e99311bde7467512165f16DB78")
  const targetContractAddressHex =
        "0x" + tryNativeToHexString("0x10219b965C8272245e3A08FBbB692539558FcaC8", CHAIN_ID_ETH);
  const receipt = await depositContract.registerEmitter(CHAIN_ID_ETH, targetContractAddressHex)
  console.log("Receipt: ", receipt)
  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// transaction hash: 0x2a7fca41bde688e79eb64ebc550d7cc6fd82227dc538775677b3918091d638d9