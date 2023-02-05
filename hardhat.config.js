require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("hardhat-abi-exporter");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
	solidity: {
		version: "0.8.15",
		settings: {
			viaIR: true,
			optimizer: {
				enabled: true,
				runs: 200,
			},
		},
	},
	etherscan: {
		apiKey: process.env.POLYGONSCAN_API_KEY,
	},
	networks: {
		avax: {
			url: "https://api.avax.network/ext/bc/C/rpc",
			chainId: 43114,
			accounts: [process.env.PRIVATE_KEY],
		},
		fuji: {
			url: "https://api.avax-test.network/ext/bc/C/rpc",
			chainId: 43113,
			accounts: [process.env.PRIVATE_KEY],
		},
		goerli: {
			url: `https://eth-goerli.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_GOERLI}`,
			accounts: [process.env.PRIVATE_KEY],
		},
		hardhat: {
			forking: {
				url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY_MAINNET}`,
				// url: `https://eth-goerli.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_GOERLI}`,
			},
		},
		mumbai: {
			url: `https://polygon-mumbai.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_MUMBAI}`,
			accounts: [process.env.PRIVATE_KEY],
		},
	},
	abiExporter: {
		path: "./data/abi",
		runOnCompile: true,
		clear: true,
		flat: true,
		spacing: 2,
		pretty: true,
	},
};
