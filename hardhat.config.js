require("@nomicfoundation/hardhat-toolbox");

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
	networks: {
		hardhat: {
			forking: {
				url: `https://eth-mainnet.alchemyapi.io/v2/rOiQsk0cIqALCVVNiqeBhir4vk388VC_`,
			},
		},
	},
	mocha: {
		timeout: 40000,
	},
};
