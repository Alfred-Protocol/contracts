// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const { ethers } = require("hardhat");

async function main() {

  const TESTING_FUJI_FORK_CHAINID = 43113
  const TESTING_FUJI_WORMHOLE_ADDRESS ="0x7bbcE28e64B3F8b84d876Ab298393c38ad7aac4C"
  const TESTING_FUJI_BRIDGE_ADDRESS = "0x61E44E506Ca5659E6c0bba9b678586fA2d729756"
  const TESTING_FUJI_WORMHOLE_CHAINID = 6

  // Deploy wormhole contract on Avalanche
  const DepositContract = await ethers.getContractFactory("HelloToken");
  let depositContract = await DepositContract.deploy(
      TESTING_FUJI_WORMHOLE_ADDRESS,
      TESTING_FUJI_BRIDGE_ADDRESS,
      TESTING_FUJI_FORK_CHAINID,
      1, // wormholeFinality
      1e6, // feePrecision
      10000 // relayerFee (percentage terms)
  )

  console.log("FUJI contract deployed on: ", depositContract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// deployed contract address: 0x6e1ef01273DbB1e99311bde7467512165f16DB78