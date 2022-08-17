// SPDX-License-Identifier: MIT 

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const delay = require("delay");


// JSON file to keep information about previous deployments
const OUTPUT_DEPLOY = require("./deployOutput.json");


let contractName;

async function main() {

  let [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();

  console.log(`[NOTICE!] Chain of deployment: ${network.name}`);

  // NOTE WrappedERC20 is not supposed to be deployed. It is deployed by the Factory.

  // ====================================================

  // Contract #1: Bridge

  // Deploy
  contractName = "Bridge";
  console.log(`[${contractName}]: Start of Deployment...`);
  _contractProto = await ethers.getContractFactory(contractName);
  // Owner gets admin rights. Fee rate is 2% (200 BPS)
  contractDeployTx = await _contractProto.deploy(owner.address, 200);
  bridge = await contractDeployTx.deployed();
  console.log(`[${contractName}]: Deployment Finished!`);
  OUTPUT_DEPLOY[network.name][contractName].address = bridge.address;

  // Verify
  console.log(`[${contractName}]: Start of Verification...`);
  
  // Sleep for 90 seconds, otherwise block explorer will fail
  await delay(90000);

  // Write deployment and verification info into the JSON file before actual verification
  // The reason is that verification may fail if you try to verify the same contract again
  // And the JSON file will not change
  OUTPUT_DEPLOY[network.name][contractName].address = bridge.address;
  if (network.name === "polygon") {
    url = "https://polygonscan.com/address/" + bridge.address + "#code";
  } else if (network.name === "mumbai") {
    url = "https://mumbai.polygonscan.com/address/" + bridge.address + "#code";
  } else if (network.name === "ethereum") {
    url = "https://etherscan.io/address/" + bridge.address + "#code";
  } else if (network.name === "rinkeby") {
    url = "https://rinkeby.etherscan.io/address/" + bridge.address + "#code";
  } else if (network.name === "bsc") {
    url = "https://bscscan.com/address/" + bridge.address + "#code";
  } 
  OUTPUT_DEPLOY[network.name][contractName].verification = url;
  
  // Verify the contract
  // Provide all contract's dependencies as separate files
  // NOTE It may fail with "Already Verified" error. Do not pay attention to it. Verification will
  // be done correctly!
  try { 
    await hre.run("verify:verify", {
      address: bridge.address,
    });
  } catch (error) {
    console.error(error);
  }
  console.log(`[${contractName}]: Verification Finished!`);
  
  // ====================================================

  // Contract #2: WrappedERCFactory

  // Deploy
  contractName = "WrappedERC20Factory";
  console.log(`[${contractName}]: Start of Deployment...`);
  _contractProto = await ethers.getContractFactory(contractName);
  // Provide the factory with bridge address.
  contractDeployTx = await _contractProto.deploy(bridge.address);
  factory = await contractDeployTx.deployed();
  console.log(`[${contractName}]: Deployment Finished!`);
  OUTPUT_DEPLOY[network.name][contractName].address = factory.address;

  // Verify
  console.log(`[${contractName}]: Start of Verification...`);
  
  // Sleep for 90 seconds, otherwise block explorer will fail
  await delay(90000);

  // Write deployment and verification info into the JSON file before actual verification
  // The reason is that verification may fail if you try to verify the same contract again
  // And the JSON file will not change
  OUTPUT_DEPLOY[network.name][contractName].address = factory.address;
  if (network.name === "polygon") {
    url = "https://polygonscan.com/address/" + factory.address + "#code";
  } else if (network.name === "mumbai") {
    url = "https://mumbai.polygonscan.com/address/" + factory.address + "#code";
  } else if (network.name === "ethereum") {
    url = "https://etherscan.io/address/" + factory.address + "#code";
  } else if (network.name === "rinkeby") {
    url = "https://rinkeby.etherscan.io/address/" + factory.address + "#code";
  } else if (network.name === "bsc") {
    url = "https://bscscan.com/address/" + factory.address + "#code";
  } 
  OUTPUT_DEPLOY[network.name][contractName].verification = url;
  
  // Verify the contract
  // Provide all contract's dependencies as separate files
  // NOTE It may fail with "Already Verified" error. Do not pay attention to it. Verification will
  // be done correctly!
  try { 
    await hre.run("verify:verify", {
      address: factory.address,
    });
  } catch (error) {
    console.error(error);
  }
  console.log(`[${contractName}]: Verification Finished!`);

  // ====================================================

  console.log(`See Results in "${__dirname + '/deployOutput.json'}" File`);
  
  fs.writeFileSync(
    path.resolve(__dirname, "./deployOutput.json"),
    JSON.stringify(OUTPUT_DEPLOY, null, "  ")
  );
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
