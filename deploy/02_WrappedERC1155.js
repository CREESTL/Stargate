module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const deployResult = await deploy("WrappedERC1155", {
    from: deployer
  });
  if (deployResult.newlyDeployed) {
    log(`WrappedERC1155 deployed at ${deployResult.address}`);
  }
};
module.exports.tags = ["deploy"];

