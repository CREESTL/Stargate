// SPDX-License-Identifier: MIT 
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const delay = require("delay");


let contractName = "CyberGenie";

// JSON file to keep information about previous deployments
const OUTPUT_DEPLOY = require("./deployOutput.json");

async function main() {

  console.log(`[NOTICE] Chain for deployment: ${network.name}`);
  console.log(`[${contractName}]: Start of Deployment...`);

  // Get the contract and deploy it
  _genie = await ethers.getContractFactory(contractName);
  genieTx = await _genie.deploy();
  let genie = await genieTx.deployed();

  console.log(`[${contractName}]: Deployment Finished!`);
  console.log(`[${contractName}]: Start of Verification...`);
  
  // Sleep for 90 seconds, otherwise block explorer will fail
  await delay(90000);

  // Write deployment and verification info into the JSON file before actual verification
  // The reason is that verification may fail if you try to verify the same contract again
  // And the JSON file will not change
  OUTPUT_DEPLOY[network.name][contractName].address = genie.address;
  if (network.name === "polygon") {
    url = "https://polygonscan.com/address/" + genie.address + "#code";
  } else if (network.name === "mumbai") {
    url = "https://mumbai.polygonscan.com/address/" + genie.address + "#code";
  } else if (network.name === "ethereum") {
    url = "https://etherscan.io//address/" + genie.address + "#code";
  } else if (network.name === "rinkeby") {
    url = "https://rinkeby.etherscan.io//address/" + genie.address + "#code";
  }
  
  OUTPUT_DEPLOY[network.name][contractName].verification = url;
  // Verify the contract
  // Provide all contract's dependencies as separate files
  // NOTE It may fail with "Already Verified" error. Do not pay attention to it. Verification will
  // be done correctly!
  try { 
    await hre.run("verify:verify", {
      address: genie.address,
    });
  } catch (error) {
    console.error(error);
  }

  console.log(`[${contractName}]: Verification Finished!`);
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
