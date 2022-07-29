const { BigNumber, bigNumberify } = require("ethers");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const { expect } = require("chai");
describe('FactoryAndToken', () => {
  var bridgeMock;
  var tokenStandart;
  var factoryToken;
  beforeEach( async () => {
    [owner] = await ethers.getSigners();
    const BridgeTokenStandardERC20 = await ethers.getContractFactory("BridgeTokenStandardERC20");
    const FactoryBridgeTokenStandardERC20 = await ethers.getContractFactory("FactoryBridgeTokenStandardERC20");
    const BridgeMock = await ethers.getContractFactory("BridgeMock");
    bridgeMock = await BridgeMock.deploy();
    tokenStandart = await BridgeTokenStandardERC20.deploy();
    factoryToken = await FactoryBridgeTokenStandardERC20.deploy(tokenStandart.address, bridgeMock.address);
  });
  describe("Creating a new token through the factory", function () {
    it('metadata', async() => {
      const newTokenAddress1 = await factoryToken.createNewToken("Test Token 1", "TT1", 8);
      const newTokenAddress2 = await factoryToken.createNewToken("Test Token 2", "TT2", 18);

      console.log(await factoryToken.getAllowedTokens());
      //console.log(newTokenAddress2);

      nt1 = await ethers.getContractAt('IBridgeTokenStandardERC20', newTokenAddress1);
      nt2 = await ethers.getContractAt('IBridgeTokenStandardERC20', newTokenAddress2);

      expect(await nt1.name()).to.be.equal("Test Token 1");
      expect(await nt1.symbol()).to.be.equal("TT1");
      expect(await nt1.decimals()).to.be.equal(8);

      expect(await nt2.name()).to.be.equal("Test Token 2");
      expect(await nt2.symbol()).to.be.equal("TT2");
      expect(await nt2.decimals()).to.be.equal(18);
    });
  });
});
