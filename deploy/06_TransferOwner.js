const fs = require("fs");
const config = JSON.parse(
  fs.readFileSync(`deploy-configs/${network.name}.json`)
);

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const _bridge = await get("Bridge");
  const _proxyAdmin = await get("DefaultProxyAdmin");
  const bridge = await ethers.getContractAt("Bridge", _bridge.address);
  const proxyAdmin = await ethers.getContractAt("ProxyAdmin", _proxyAdmin.address);

  const newOwner = config.admin;
  const role = await bridge.DEFAULT_ADMIN_ROLE();

  await bridge.setAdmin(newOwner);
  await bridge.renounceRole(role, deployer);
  await proxyAdmin.transferOwnership(newOwner);
  log("Ownership transferred");
}
module.exports.tags = ["transferOwnership"];

