const { ethers, run } = require("hardhat");

const NonfungiblePositionManagerAddress =
	"0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
const SwapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

async function main() {
	const [deployer] = await ethers.getSigners();

	console.log("Deploying contracts with the account:", deployer.address);
	console.log("Account balance:", (await deployer.getBalance()).toString());

	const FundsFactory = await ethers.getContractFactory("FundsFactory");
	const fundsFactory = await FundsFactory.deploy(
		SwapRouterAddress,
		NonfungiblePositionManagerAddress
	);

	console.log(`FundsFactory deployed to: ${fundsFactory.address}`);

	console.log("\nWaiting 60 sec before verifying...");
	await new Promise((resolve) => setTimeout(resolve, 60 * 1000));

	await run("verify:verify", {
		address: fundsFactory.address,
		// constructorArguments: [],
	});
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
