// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");

async function main() {

  const TESTING_GOERLI_FORK_CHAINID = 5
  const TESTING_GOERLI_WORMHOLE_ADDRESS ="0x706abc4E45D419950511e474C7B9Ed348A4a716c"
  const TESTING_GOERLI_BRIDGE_ADDRESS = "0xF890982f9310df57d00f659cf4fd87e65adEd8d7"
  const TESTING_GOERLI_WORMHOLE_CHAINID = 2

  // Deploy wormhole contract on Avalanche
  const DepositContract = await ethers.getContractFactory("HelloToken");
  let depositContract = await DepositContract.deploy(
      TESTING_GOERLI_WORMHOLE_ADDRESS,
      TESTING_GOERLI_BRIDGE_ADDRESS,
      TESTING_GOERLI_FORK_CHAINID,
      1, // wormholeFinality
      1e6, // feePrecision
      10000 // relayerFee (percentage terms)
  )

  console.log("GOERLI contract deployed on: ", depositContract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// deploy contract address: 0x10219b965C8272245e3A08FBbB692539558FcaC8
