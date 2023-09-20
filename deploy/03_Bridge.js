const fs = require("fs");
const config = JSON.parse(
  fs.readFileSync(`deploy-configs/${network.name}.json`)
);

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const OPERATOR = config.operator;
  const STABLECOIN = config.stablecoin;
  const CHAIN = config.chain;

  const deployResult = await deploy("Bridge", {
    from: deployer,
    proxy: {
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [
          OPERATOR,
          STABLECOIN,
          CHAIN
        ],
      },
    },
  });
  if (deployResult.newlyDeployed) {
    log(`Bridge deployed at ${deployResult.address}`);
  }
};
module.exports.tags = ["deploy"];
