require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require("@nomiclabs/hardhat-etherscan");
require("@nomicfoundation/hardhat-chai-matchers");
require("hardhat-change-network");
require('hardhat-contract-sizer');
require("solidity-coverage");

const {
        BSCSCAN_API_KEY,
        POLYGONSCAN_API_KEY,
        ETHERSCAN_API_KEY,
        ACC_PRIVATE_KEY,
        INFURA_API_KEY
    } = process.env;

module.exports = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // BSC testnet
    bscTestnet: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      accounts: [ACC_PRIVATE_KEY]
    },
    // BSC mainnet
    bsc: {
      url: "https://rpc.ankr.com/bsc",
      accounts: [ACC_PRIVATE_KEY]
    },
    // Polygon Mumbai testnet
    mumbai: {
      url:  "https://matic-mumbai.chainstacklabs.com",
      accounts: [ACC_PRIVATE_KEY]
    },
    // Polygon mainnet
    polygon: {
      url: "https://rpc-mainnet.maticvigil.com",
      accounts: [ACC_PRIVATE_KEY]
    },
    // Ethereum Goerli testnet
    goerli: {
      url: 'https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
      accounts: [ACC_PRIVATE_KEY]
    },
    // Ethereum mainnet
    ethereum: {
      url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [ACC_PRIVATE_KEY]
    }
  },
  mocha: {
    timeout: 20000000000
  },
  etherscan: {
    apiKey: {
      bscTestnet: BSCSCAN_API_KEY,
      goerli: ETHERSCAN_API_KEY,
      mumbai: POLYGONSCAN_API_KEY
    }
  },
  skipFiles: ["node_modules"],
    gasReporter: {
        enabled: true,
        url: "http://localhost:8545"
    },
};
