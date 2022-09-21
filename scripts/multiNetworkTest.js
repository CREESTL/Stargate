const { ethers } = require("hardhat");

const BRIDGE_ETH = "0x7bA17c286dFC01188B1a5b333BCDF28D25fbf56E";
const BRIDGE_MATIC = "0x32784Fe061F92746e036124160b169BC36fc98b5";
const TOKEN_ETH = "0xe24c16f004857070FEA39C6D43fc4754eAb197F7";
const TOKEN_MATIC = "0xD26DbC59b52459E3300624AfFAEf8EFde6B2219b";

async function main() {
    let amount = 1000000;

    let [walletETH] = await ethers.getSigners();
    const bridgeETH = await ethers.getContractAt("Bridge", BRIDGE_ETH);
    const tokenETH = await ethers.getContractAt("TestERC20", TOKEN_ETH);
    
    await tokenETH.approve(BRIDGE_ETH, amount);
    await bridgeETH.lockERC20(
        TOKEN_ETH,
        amount,
        walletETH.address,
        "PolygonTest",
        {value: amount}
    );
    console.log("Ethereum tokens locked");
    
    hre.changeNetwork("mumbai");
    
    let [walletMatic] = await ethers.getSigners();
    const bridgeMatic = await ethers.getContractAt("Bridge", BRIDGE_MATIC);
    const tokenMatic = await ethers.getContractAt("TestERC20", TOKEN_MATIC);
    
    await tokenMatic.approve(BRIDGE_MATIC, amount);
    await bridgeMatic.lockERC20(
        TOKEN_MATIC,
        amount,
        walletMatic.address,
        "BinanceSmartChainTestnet",
        {value: amount}
    );
    console.log("Matic tokens locked");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });





