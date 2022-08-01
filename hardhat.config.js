require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("solidity-coverage");
require("hardhat-gas-reporter");

const {
        BSCSCAN_API_KEY,
        POLYSCAN_API_KEY,
        ETHERSCAN_API_KEY,
        ANKR_BSC_TESTNET_KEY,
        ANKR_BSC_MAINNET_KEY,
        MNEMONIC
    } = process.env;
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.11",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    bsc_testnet: {
      url: `https://apis.ankr.com/${ANKR_BSC_TESTNET_KEY}/537a98904656e403a57bb70fa11c1a73/binance/full/test`,
      chainId: 97,
      gasPrice: 20000000000,
      accounts: {mnemonic: MNEMONIC},
    },
    bsc_mainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      gasPrice: 20000000000,
      accounts: {mnemonic: MNEMONIC}
    },
    polygon_testnet: {
      url: `https://apis.ankr.com/${ANKR_BSC_MAINNET_KEY}/537a98904656e403a57bb70fa11c1a73/binance/full/test`,
      chainId: 97,
      gasPrice: 20000000000,
      accounts: {mnemonic: MNEMONIC},
    },
    polygon_mainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      gasPrice: 20000000000,
      accounts: {mnemonic: MNEMONIC}
    },
      eth_mainnet: {
          url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_ETH_MAINNET_API_KEY}`,
          accounts: { mnemonic: process.env.MNEMONIC },
          chainId: 1
      },
      eth_testnet: {
          url: `https://eth-rinkeby.alchemyapi.io/v2/${process.env.ALCHEMY_ETH_RINKEBY_API_KEY}`,
          accounts: { mnemonic: process.env.MNEMONIC },
          chainId: 4
      }
  },
  mocha: {
    timeout: 400000
  },
  etherscan: {
    apiKey: {
      bscTestnet: BSCSCAN_API_KEY,
      bsc: BSCSCAN_API_KEY,
      ethereum: ETHERSCAN_API_KEY,
      polygon: POLYSCAN_API_KEY
    }
  },
  skipFiles: ["node_modules"],
    gasReporter: {
        enabled: true,
        url: "http://localhost:8545"
    },
};
