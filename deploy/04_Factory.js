module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const wERC20 = await get("WrappedERC20");
  const wERC721 = await get("WrappedERC721");
  const wERC1155 = await get("WrappedERC1155");

  const deployResult = await deploy("WrappedTokenFactory", {
    from: deployer,
    proxy: {
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [
          wERC20.address,
          wERC721.address,
          wERC1155.address,
        ],
      },
    },
  });
  if (deployResult.newlyDeployed) {
    log(`Factory deployed at ${deployResult.address}`);
  }
};
module.exports.tags = ["deploy"];

