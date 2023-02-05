const { ethers, run } = require("hardhat");
const {
	UNI_SWAP_ROUTER_ADDRESS,
	UNI_NON_FUNGIBLE_POSITION_MANAGER_ADDRESS,
} = require("../constants/index");

async function main() {
	const [deployer] = await ethers.getSigners();

	console.log("Deploying contracts with the account:", deployer.address);
	console.log("Account balance:", (await deployer.getBalance()).toString());

	const FundsFactory = await ethers.getContractFactory("FundsFactory");
	const fundsFactory = await FundsFactory.deploy(
		UNI_SWAP_ROUTER_ADDRESS,
		UNI_NON_FUNGIBLE_POSITION_MANAGER_ADDRESS
	);

	console.log(`FundsFactory deployed to: ${fundsFactory.address}`);

	console.log("\nWaiting 60 sec before verifying...");
	await new Promise((resolve) => setTimeout(resolve, 60 * 1000));

	await run("verify:verify", {
		address: fundsFactory.address,
		constructorArguments: [
			UNI_SWAP_ROUTER_ADDRESS,
			UNI_NON_FUNGIBLE_POSITION_MANAGER_ADDRESS,
		],
	});
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
