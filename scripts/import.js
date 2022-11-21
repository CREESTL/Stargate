// SPDX-License-Identifier: MIT 

const { ethers, upgrades, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const delay = require("delay");
const config = require("../config")

const {ACC_ADDRESS} = config;
// JSON file to keep information about previous deployments
const OUTPUT_DEPLOY = require("./deployOutput.json");

let contractName;

async function main() {

  let [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();
  console.log(`[NOTICE!] Chain of deployment: ${network.name}`);

  // ====================================================

  // Contract #1: Bridge

  // Deploy
  contractName = "Bridge";
  console.log(`[${contractName}]: Start of Deployment...`);
  _contractProto = await ethers.getContractFactory(contractName);
  await upgrades.forceImport(
    OUTPUT_DEPLOY[network.name][contractName].address,
    _contractProto
  )
  
  console.log(`[${contractName}]: Deployment Finished!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });