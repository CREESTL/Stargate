const { BigNumber, bigNumberify } = require("ethers");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const { expect } = require("chai");
describe('FactoryAndToken', () => {
  var bridgeMock;
  var tokenStandart;
  var factoryToken;
  beforeEach( async () => {
    [owner, client] = await ethers.getSigners();
    const BridgeTokenStandardERC20 = await ethers.getContractFactory("BridgeTokenStandardERC20");
    const FactoryBridgeTokenStandardERC20 = await ethers.getContractFactory("FactoryBridgeTokenStandardERC20");
    const BridgeMock = await ethers.getContractFactory("BridgeMock");
    bridgeMock = await BridgeMock.deploy();
    tokenStandart = await BridgeTokenStandardERC20.deploy();
    factoryToken = await FactoryBridgeTokenStandardERC20.deploy(tokenStandart.address, bridgeMock.address);
  });
  describe("Creating a new token through the factory", function () {

    it('Create new token', async() => {
      await factoryToken.createNewToken("Test Token 1", "TT1", 8);
      await factoryToken.createNewToken("Test Token 2", "TT2", 18);

      [address1, address2] = await factoryToken.getAllowedTokens();

      nt1 = await ethers.getContractAt('IBridgeTokenStandardERC20', address1);
      nt2 = await ethers.getContractAt('IBridgeTokenStandardERC20', address2);

      expect(await nt1.name()).to.be.equal("Test Token 1");
      expect(await nt1.symbol()).to.be.equal("TT1");
      expect(await nt1.decimals()).to.be.equal(8);

      expect(await nt2.name()).to.be.equal("Test Token 2");
      expect(await nt2.symbol()).to.be.equal("TT2");
      expect(await nt2.decimals()).to.be.equal(18);
    });

    it('Remove a token from an array', async() => {
      address1 = await factoryToken.createNewToken("Test Token 1", "TT1", 8);
      address2 = await factoryToken.createNewToken("Test Token 2", "TT2", 18);
      address1 = await factoryToken.createNewToken("Test Token 3", "TT3", 8);
      address2 = await factoryToken.createNewToken("Test Token 4", "TT4", 18);
      [address1, address2, address3, address4] = await factoryToken.getAllowedTokens();
      // console.log(await factoryToken.getAllowedTokens());
      expect(await factoryToken.getAllowedToken(address1)).to.be.true;
      await factoryToken.removeFromAllowedToken(address1);
      expect(await factoryToken.getAllowedToken(address1)).to.be.false;
      expect(await factoryToken.getAllowedToken(address3)).to.be.true;
      await factoryToken.removeFromAllowedToken(address3);
      expect(await factoryToken.getAllowedToken(address3)).to.be.false;
      // console.log(await factoryToken.getAllowedTokens());
    });

    it('Set functions', async() => {
      const TestBridge = await ethers.getContractFactory("BridgeTokenStandardERC20");
      testBridge = await TestBridge.deploy();
      expect(await factoryToken.bridge()).to.be.equal(bridgeMock.address);
      await factoryToken.setBridge(testBridge.address);
      expect(await factoryToken.bridge()).to.be.equal(testBridge.address);

      const TestBridgeTokenStandardERC20 = await ethers.getContractFactory("BridgeTokenStandardERC20");
      testTokenStandart = await TestBridgeTokenStandardERC20.deploy();
      expect(await factoryToken.bridgeTokenStandard()).to.be.equal(tokenStandart.address);
      await factoryToken.setBridgeTokenStandardERC20(testTokenStandart.address);
      expect(await factoryToken.bridgeTokenStandard()).to.be.equal(testTokenStandart.address);
    });
  });

  describe("Checking admin functions", function () {

    it('Set functions', async() => {
      const TestBridge = await ethers.getContractFactory("BridgeTokenStandardERC20");
      testBridge = await TestBridge.deploy();
      expect(await factoryToken.bridge()).to.be.equal(bridgeMock.address);
      await expect(factoryToken.connect(client).setBridge(testBridge.address))
          .to.be.revertedWith("onlyAdmin");
      expect(await factoryToken.bridge()).to.be.equal(bridgeMock.address);

      const TestBridgeTokenStandardERC20 = await ethers.getContractFactory("BridgeTokenStandardERC20");
      testTokenStandart = await TestBridgeTokenStandardERC20.deploy();
      expect(await factoryToken.bridgeTokenStandard()).to.be.equal(tokenStandart.address);
      await expect(factoryToken.connect(client).setBridgeTokenStandardERC20(testTokenStandart.address))
          .to.be.revertedWith("onlyAdmin");
      expect(await factoryToken.bridgeTokenStandard()).to.be.equal(tokenStandart.address);
    });

    it('Create functions', async() => {
      await expect(factoryToken.connect(client).createNewToken("Test Token 1", "TT1", 8))
          .to.be.revertedWith("onlyAdmin");
    });
    it('Create functions', async() => {
      await factoryToken.createNewToken("Test Token 1", "TT1", 8);
      await factoryToken.createNewToken("Test Token 2", "TT2", 18);
      await factoryToken.createNewToken("Test Token 3", "TT3", 8);
      await factoryToken.createNewToken("Test Token 4", "TT4", 18);
      [address1, address2, address3, address4] = await factoryToken.getAllowedTokens();
      // console.log(await factoryToken.getAllowedTokens());
      expect(await factoryToken.getAllowedToken(address1)).to.be.true;
      await expect(factoryToken.connect(client).removeFromAllowedToken(address1))
          .to.be.revertedWith("onlyAdmin");
      expect(await factoryToken.getAllowedToken(address1)).to.be.true;
    });
  });

  describe("Checking ERC20 functions", function () {
    it('Mint function', async() => {
      decimals = BigNumber.from(10).pow(18);
      var mintAmount = BigNumber.from(500).mul(decimals);

      await factoryToken.createNewToken("Test Token 1", "TT1", 8);

      [address1] = await factoryToken.getAllowedTokens();
      nt1 = await ethers.getContractAt('IBridgeTokenStandardERC20', address1);

      expect(await nt1.balanceOf(client.address)).to.be.equal(0);
      await bridgeMock.mint(client.address, mintAmount, nt1.address);
      expect(await nt1.balanceOf(client.address)).to.be.equal(mintAmount);
    });
  });
});
