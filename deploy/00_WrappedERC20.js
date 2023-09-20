module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const deployResult = await deploy("WrappedERC20", {
    from: deployer
  });
  if (deployResult.newlyDeployed) {
    log(`WrappedERC20 deployed at ${deployResult.address}`);
  }
};
module.exports.tags = ["deploy"];

