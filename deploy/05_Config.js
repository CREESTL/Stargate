const fs = require("fs");
const config = JSON.parse(
  fs.readFileSync(`deploy-configs/${network.name}.json`)
);

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  const _wERC20 = await get("WrappedERC20");
  const _wERC721 = await get("WrappedERC721");
  const _wERC1155 = await get("WrappedERC1155");
  const _bridge = await get("Bridge");

  const wERC20 = await ethers.getContractAt("WrappedERC20", _wERC20.address);
  const wERC721 = await ethers.getContractAt("WrappedERC721", _wERC721.address);
  const wERC1155 = await ethers.getContractAt("WrappedERC1155", _wERC1155.address);
  const bridge = await ethers.getContractAt("Bridge", _bridge.address);

  const supportedChains = config.supportedChains;
  if(await wERC20.bridge() == ethers.constants.AddressZero){
    await wERC20.initialize("WERC20-STARGATE", "WERC20-STRGT", 18, _bridge.address);
  }
  if(await wERC721.bridge() == ethers.constants.AddressZero){
    await wERC721.initialize("WERC721-STARGATE", "WERC721-STRGT", _bridge.address);
  }
  if(await wERC1155.bridge() == ethers.constants.AddressZero){
    await wERC1155.initialize("WERC1155-STARGATE", _bridge.address);
  }
  for(let i=0; i<supportedChains.length; i++) {
    if(await bridge.supportedChains(supportedChains[i]))
      continue;
    console.log(supportedChains[i]);
    await bridge.setSupportedChain(supportedChains[i]);
  }
  log("Config finished");
}
module.exports.tags = ["config"];
