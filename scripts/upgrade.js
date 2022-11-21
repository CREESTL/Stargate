// SPDX-License-Identifier: MIT 

const { ethers, upgrades, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const delay = require("delay");
const config = require("../config")

const {ACC_ADDRESS} = config;
// JSON file to keep information about previous deployments
const OUTPUT_DEPLOY = require("./deployOutput.json");
const CHAINS = require("./chains.json")

let contractName;

async function main() {

  let [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
  let tokens = config[network.name];
  console.log(`[NOTICE!] Chain of deployment: ${network.name}`);

  // ====================================================

  // Contract #1: Bridge

  // Deploy
  contractName = "Bridge";
  console.log(`[${contractName}]: Start of Deployment...`);
  _contractProto = await ethers.getContractFactory(contractName);
  // await upgrades.forceImport(
  //   OUTPUT_DEPLOY[network.name][contractName].address,
  //   _contractProto
  // )
  contractUpgradeTx = await upgrades.upgradeProxy(
    OUTPUT_DEPLOY[network.name][contractName].address,
    _contractProto,
    [
      ACC_ADDRESS,
      tokens.STABLECOIN,
      tokens.STARGATE,
      CHAINS[network.name]
    ],
    {initializer:'initialize'}
  );
  
  // bridge = await contractUpgradeTx.deployed();
  console.log(`[${contractName}]: Deployment Finished!`);
  // OUTPUT_DEPLOY[network.name][contractName].address = bridge.address;

  // // Verify
  // console.log(`[${contractName}]: Start of Verification...`);
  
  // // Sleep for 90 seconds, otherwise block explorer will fail
  // await delay(90000);

  // // Write deployment and verification info into the JSON file before actual verification
  // // The reason is that verification may fail if you try to verify the same contract again
  // // And the JSON file will not change
  // OUTPUT_DEPLOY[network.name][contractName].address = bridge.address;
  // if (network.name === "polygon") {
  //   url = "https://polygonscan.com/address/" + bridge.address + "#code";
  // } else if (network.name === "polygonMumbai") {
  //   url = "https://polygonMumbai.polygonscan.com/address/" + bridge.address + "#code";
  // } else if (network.name === "ethereum") {
  //   url = "https://etherscan.io/address/" + bridge.address + "#code";
  // } else if (network.name === "goerli") {
  //   url = "https://goerli.etherscan.io/address/" + bridge.address + "#code";
  // } else if (network.name === "bsc") {
  //   url = "https://bscscan.com/address/" + bridge.address + "#code";
  // } else if (network.name === "bscTestnet") {
  //   url = "https://testnet.bscscan.com/address/" + bridge.address + "#code";
  // }
  // OUTPUT_DEPLOY[network.name][contractName].verification = url;
  
  // // Provide all contract's dependencies as separate files
  // // NOTE It may fail with "Already Verified" error. Do not pay attention to it. Verification will
  // // be done correctly!
  // try { 
  //   await hre.run("verify:verify", {
  //     address: bridge.address,
  //   });
  // } catch (error) {
  //   console.error(error);
  // }
  // console.log(`[${contractName}]: Verification Finished!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });