# Stargat smart-contracts

The following information will guide you through the process of building and deploying the contracts yourself.  

## Prerequisites :page_with_curl:
- Install [Node.js](https://nodejs.org/en/download/)
- Clone this repository with `git clone https://git.sfxdx.ru/nft-audit/nft-audit-sc.git`
- Navigate to the directory with the cloned code
- Install [Hardhat](https://hardhat.org/) with `npm install --save-dev hardhat`
- Install all required dependencies with `npm install`
- Create a file called `.env` in the root of the project with the same contents as `.env.example`
- Copy your wallet's private key (see [Wallets](#Wallets)) to `.env` file
    ```
    PRIVATE_KEY=***your private key***
    ```
- Create an account on [Etherscan](https://etherscan.io/). Go to `Account -> API Keys`. Create a new API key. Copy it to `.env` file
    ```
    ETHERSCAN_API_KEY=***your etherscan API key***
    ```
- Create an account on [Polygonscan](https://polygonscan.com/). Go to `Account -> API Keys`. Create a new API key. Copy it to `.env` file
    ```
    POLYGONSCAN_API_KEY=***your polygonscan API key***
    ```
- Create an account on [Infura](https://infura.io/). Go to `Dashboard -> Create new key -> Manage key`. Copy `API key` to `.env` file
    ```
    INFURA_API_KEY=***your infura API key***
    ```
:warning:__DO NOT SHARE YOUR .env FILE IN ANY WAY OR YOU RISK TO LOSE ALL YOUR FUNDS__:warning:

## Build & Deploy
### 1. Build

```
npx hardhat compile
```

### 2. Deploy
Start  deployment _only_ if build was successful!

#### Testnets
а) __Rinkeby__ test network  
Make sure you have _enough RinkebyETH_ tokens for testnet. You can get it for free from [faucet](https://faucet.rinkeby.io/). 
```
npx hardhat run scripts/deploy.js --network rinkeby
```  

b) __Mumbai__ test network  
Make sure you have _enough MATIC_ tokens for testnet. You can get it for free from [faucet](https://faucet.polygon.technology/). 
```
npx hardhat run scripts/deploy.js --network mumbai
```

#### Mainnets
c) __Ethereum__ main network  
Make sure you have _enough real ether_ in your wallet. Deployment to the mainnet costs money!
```
npx hardhat run scripts/deploy.js --network ethereum
```

c) __Polygon__ main network  
Make sure you have _enough real MATIC_ in your wallet. Deployment to the mainnet costs money!
```
npx hardhat run scripts/deploy.js --network polygon
```
Deployment script takes more than 1.5 minutes to complete. Please, be patient!.  

After the contracts get deployed you can find their _addresses_ and code verification _URLs_ in the `deployOutput.json` file.
You have to provide these wallets with real/test tokens in order to _call contracts' methods_ from them. 

Please note that all deployed contracts __are verified__ on either [Etherscan](https://etherscan.io/) (testnet [Ethersan](https://rinkeby.etherscan.io/)) or [Polygonscan](https://polygonscan.com/) (testnet [Polygonscan](https://mumbai.polygonscan.com/)).

## Wallets
For deployment you will need to use either _your existing wallet_ or _a generated one_. 

### Using existing wallet
If you choose to use your existing wallet, then you will need to be able to export (copy/paste) its private key. For example, you can export private key from your MetaMask wallet.  
Wallet's private key should be pasted into the `.env` file (see [Prerequisites](##Prerequisites)).   

### Creating a new wallet
If you choose to create a fresh wallet for this project, you should use `createWallet` script from `scripts/` directory.
```
npx hardhat run scripts/createWallet.js
```
This will generate a single new wallet and show its address and private key. __Save__ them somewhere else!  
A new wallet _does not_ hold any tokens. You have to provide it with tokens of your choice.  
Wallet's private key should be pasted into the `.env` file (see [Prerequisites](##Prerequisites)). 

