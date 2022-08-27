# Stargate Multichain Bridge  
Stargate bridge is designed to provide users an ability to transfer their assets between multiple blockhains. In this repository you will find smart-contracts and scripts for EVM-compatible chains (Ethereum, Polygon, BSC).


#### Table on contents
[Build & Deploy](#build_and_deploy)  
[Wallets](#wallets)  
[Usage Logic](#logic)  
[Types of Tokens](#token_types)  

<a name="build_and_deploy"/>

### Build & Deploy  
The following information will guide you through the process of building and deploying the contracts yourself.  

<a name="prerequisites"/>

### Prerequisites
- Install [Node.js](https://nodejs.org/en/download/)
- Clone this repository with `git clone https://git.sfxdx.ru/stargate/stargate-sc.git`
- Navigate to the directory with the cloned code
- Install [Hardhat](https://hardhat.org/) with `npm install --save-dev hardhat`
- Install all required dependencies with `npm install`
- Create a file called `.env` in the root of the project with the same contents as `.env.example`
- Copy your wallet's private key (see [Wallets](#wallets)) to `.env` file
    ```
    ACC_PRIVATE_KEY=***your private key***
    ```
- Copy your wallet's address to `.env` file
    ```
    ACC_ADDRESS=***your address***
    ```
- Create an account on [Etherscan](https://etherscan.io/). Go to `Account -> API Keys`. Create a new API key. Copy it to `.env` file
    ```
    ETHERSCAN_API_KEY=***your etherscan API key***
    ```
- Create an account on [Polygonscan](https://polygonscan.com/). Go to `Account -> API Keys`. Create a new API key. Copy it to `.env` file
    ```
    POLYGONSCAN_API_KEY=***your polygonscan API key***
    ```
- Create an account on [BscScan](https://bscscan.com/). Go to `Account -> API Keys`. Create a new API key. Copy it to `.env` file
    ```
    BSCSCAN_API_KEY=***your bscscan API key***
    ```
- Create an account on [Infura](https://infura.io/). Go to `Dashboard -> Create new key -> Manage key`. Copy API key to `.env` file
    ```
    INFURA_API_KEY=***your infura API key***
    ```
:warning:__DO NOT SHARE YOUR .env FILE IN ANY WAY OR YOU RISK TO LOSE ALL YOUR FUNDS__:warning:

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

c) __Chapel__ test network  
Make sure you have _enough BNB_ tokens for testnet. You can get it for free from [faucet](https://testnet.binance.org/faucet-smart). 
```
npx hardhat run scripts/deploy.js --network chapel
```

#### Mainnets
a) __Ethereum__ main network  
Make sure you have _enough real ether_ in your wallet. Deployment to the mainnet costs money!
```
npx hardhat run scripts/deploy.js --network ethereum
```

b) __Polygon__ main network  
Make sure you have _enough real MATIC_ in your wallet. Deployment to the mainnet costs money!
```
npx hardhat run scripts/deploy.js --network polygon
```

c) __BSC__ main network  
Make sure you have _enough real BNB_ in your wallet. Deployment to the mainnet costs money!
```
npx hardhat run scripts/deploy.js --network bsc
```

Deployment script takes more than 1.5 minutes to complete. Please, be patient!.   

After the contracts get deployed you can find their _addresses_ and code verification _URLs_ in the `deployOutput.json` file.
You have to provide these wallets with real/test tokens in order to _call contracts' methods_ from them. 

Please note that all deployed contracts __are verified__ on either [Etherscan](https://etherscan.io/) (testnet [Ethersan](https://rinkeby.etherscan.io/)), [Polygonscan](https://polygonscan.com/) (testnet [Polygonscan](https://mumbai.polygonscan.com/)) or [BscScan](https://polygonscan.com/) (testnet [BscScan](https://testnet.bscscan.com/)).

<a name="wallets"/>

### Wallets
For deployment you will need to use either _your existing wallet_ or _a generated one_. 

#### Using existing wallet
If you choose to use your existing wallet, then you will need to be able to export (copy/paste) its private key. For example, you can export private key from your MetaMask wallet.  
Wallet's address and private key should be pasted into the `.env` file (see [Prerequisites](#prerequisites)).  

#### Creating a new wallet
If you choose to create a fresh wallet for this project, you should use `createWallet` script from `scripts/` directory.
```
npx hardhat run scripts/createWallet.js
```
This will generate a single new wallet and show its address and private key. __Save__ them somewhere else!  
A new wallet _does not_ hold any tokens. You have to provide it with tokens of your choice.  
Wallet's address and private key should be pasted into the `.env` file (see [Prerequisites](#prerequisites)).
 
<a name="logic"/>

### Usage Logic
Four essential parts of any bridge between two blockchains are:
- Bridge contract on the source chain
- Bridge contract on the target chain
- Contract factory on the target chain
- Backend  

Only first three parts are present in this repository.  
Source chain is the chain the tokens are initially on.   
Target chain is the chain the tokens are supposed to be transfered to.    

Let's suppose you wish to transfer 1 ETH from your address on Ethereum to your address on Polygon.
1. You have to _lock_ 1 ETH on Ethereum, i.e. send 1 ETH to the Bridge contract where it will be stored as long as you wish
2. Bridge backend _checks if there is wrappedETH_ token deployed on Polygon already  
    2.1 If not - Bridge tells Contract Factory to create and deploy a new wrapped token that will be an equivalent for ETH but on Polygon
3. Bridge backend is now aware that you have locked your token on the source chain. It forms a special unit of data called _permission digest_. This unit contains information about your address, operation that you've perfomed (locked tokens) etc.
4. Bridge backend tells Bridge contract on Polygon to _mint_ 1 wrappedETH to your address on Polygon. And provides the previously formed permission digest
5. Bridge contract analyzes the digest to check that your are allowed to receice 1 wrappedETH
6. If digest is verified then Bridge contract tells Contract Factory to _mint_ 1 wrappedETH to your address on Polygon

1 ETH was successfuly transfered between two chains in one direction.

Now let's imagine that you wish to transfer 1 ETH (that is now represented in 1 wrappedETH) back from Polygon to Ethereum.
1. You have to _burn_ 1 wrappedETH on Polygon. This token will be destroyed forever
2. Bridge backend is now aware that you have burnt your token on the target chain. It forms another permission digest.
3. Bridge backend tells Bridge contract on Ethereum to _unlock_ 1 ETH and send it to your address on Ethereum. Permission digest is also provided to the Bridge contract this time
4. Bridge contract analyzes the digest to check that your are allowed to receice 1 ETH back
5. If digest is verified then Bridge contract unlockes 1 ETH and transfers it back to your Ethereum address

1 ETH was successfuly transfered between two chains in opposite direction.

<a name="token_types"/>

### Types of Tokens
Bridge supports the following operations with different types of tokens:
|       Operation       | Native | ERC20 | ERC721 | ERC1155 |
| --------------------- | ------ | ----- | ------ | ------- |
| Lock (source chain)   |   *    |   *   |   *    |    *    |
| Unlock (source chain) |   *    |   *   |   *    |    *    |
| Mint (target chain)   |        |   *   |   *    |    *    |
| Burn (target chain)   |        |   *   |   *    |    *    |

__Important to know__: Bridge does not suport ERC1155's [batch operation](https://docs.openzeppelin.com/contracts/4.x/erc1155#batch-operations)
