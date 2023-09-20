require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require("@nomiclabs/hardhat-etherscan");
require("@nomicfoundation/hardhat-chai-matchers");
require("hardhat-change-network");
require('hardhat-contract-sizer');
require("solidity-coverage");
require("hardhat-deploy");

const {
        BSCSCAN_API_KEY,
        POLYGONSCAN_API_KEY,
        ETHERSCAN_API_KEY,
        ACC_PRIVATE_KEY,
        MUMBAI_ALCHEMY_KEY,
        SEPOLIA_ALCHEMY_KEY,
        ETHEREUM_ALCHEMY_KEY
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
  namedAccounts: {
    deployer: {
      default: 0,
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
      accounts: [ACC_PRIVATE_KEY],
      verify: {
        etherscan: {
          apiKey: BSCSCAN_API_KEY
        }
      }
    },
    // BSC mainnet
    bsc: {
      url: "https://rpc.ankr.com/bsc",
      accounts: [ACC_PRIVATE_KEY],
      verify: {
        etherscan: {
          apiKey: BSCSCAN_API_KEY
        }
      }
    },
    // Polygon polygonMumbai testnet
    polygonMumbai: {
      url:  `https://polygon-mumbai.g.alchemy.com/v2/${MUMBAI_ALCHEMY_KEY}`,
      accounts: [ACC_PRIVATE_KEY],
      verify: {
        etherscan: {
          apiKey: POLYGONSCAN_API_KEY
        }
      }
    },
    // Polygon mainnet
    polygon: {
      url: "https://rpc-mainnet.maticvigil.com",
      accounts: [ACC_PRIVATE_KEY],
      verify: {
        etherscan: {
          apiKey: POLYGONSCAN_API_KEY
        }
      }
    },
    // Ethereum Goerli testnet
    goerli: {
      url: 'https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
      accounts: [ACC_PRIVATE_KEY],
      verify: {
        etherscan: {
          apiKey: ETHERSCAN_API_KEY
        }
      }
    },
    // Ethereum Sepolia testnet
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${SEPOLIA_ALCHEMY_KEY}`,
      accounts: [ACC_PRIVATE_KEY],
      verify: {
        etherscan: {
          apiKey: ETHERSCAN_API_KEY
        }
      }
    },
    // Ethereum mainnet
    ethereum: {
      url: `https://eth-mainnet.g.alchemy.com/v2/${ETHEREUM_ALCHEMY_KEY}`,
      accounts: [ACC_PRIVATE_KEY],
      gasPrice: 11000000000,
      verify: {
        etherscan: {
          apiKey: ETHERSCAN_API_KEY
        }
      }
    }
  },
  mocha: {
    timeout: 20000000000
  },
  etherscan: {
    apiKey: {
      bsc: "6Z22N2HXHD1413WYP3JWRMA74VXGJQEB6R",
      mainnet: "H75YM5Z7HFY3EP1HBXPI9X5CRTJBVNM2HV",
      polygon: "Q2KK158IMHK5N6URZJ7J4CZ4PTIIYTWX83",
      bscTestnet: "6Z22N2HXHD1413WYP3JWRMA74VXGJQEB6R",
      goerli: "H75YM5Z7HFY3EP1HBXPI9X5CRTJBVNM2HV",
      polygonMumbai: "Q2KK158IMHK5N6URZJ7J4CZ4PTIIYTWX83"
    }
  },
  skipFiles: ["node_modules"],
    gasReporter: {
        enabled: true,
        url: "http://localhost:8545"
    },
};
