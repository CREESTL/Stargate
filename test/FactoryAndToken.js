// SPDX-License-Identifier: MIT

const { BigNumber, bigNumberify } = require("ethers");
const { ethers } = require("hardhat");
const { expect } = require("chai");
const { parseEther } = ethers.utils;
const { addressZero } = ethers.constants.AddressZero;
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");


describe('FactoryAndToken', () => {

  // Constants to be used afterwards
  let token;
  let factory;
  let bridge;

  beforeEach( async () => {
    [owner, client, acc3, acc4, bridge] = await ethers.getSigners();
    let tokenTx = await ethers.getContractFactory("WrappedERC20");
    let factoryTx = await ethers.getContractFactory("WrappedERC20Factory");
    let bridgeTx = await ethers.getContractFactory("Bridge");
    // Owner is a bot messenger. Fee rate is 1%
    bridge = await bridgeTx.deploy(owner.address, 100);
    token = await tokenTx.deploy("Integral", "SFXDX", 18, bridge.address);
    factory = await factoryTx.deploy();

    await token.deployed();
    await factory.deployed();
    await bridge.deployed();

  });

  describe("Factory", function () {

    it('Should create a new token', async() => {
      await expect(factory.createNewToken("ETH", acc3.address, "Integral", "SFXDX", 18, bridge.address)).to.emit(factory, "CreateNewToken")
        .withArgs("ETH", acc3.address, "Integral", anyValue); // anyValue used because token address in unknown
    });

  //   it('Remove a token from an array', async() => {
  //     address1 = await factoryToken.createNewToken("Test Token 1", "TT1", 8);
  //     address2 = await factoryToken.createNewToken("Test Token 2", "TT2", 18);
  //     address1 = await factoryToken.createNewToken("Test Token 3", "TT3", 8);
  //     address2 = await factoryToken.createNewToken("Test Token 4", "TT4", 18);
  //     [address1, address2, address3, address4] = await factoryToken.getAllowedTokens();
  //     // console.log(await factoryToken.getAllowedTokens());
  //     expect(await factoryToken.getAllowedToken(address1)).to.be.true;
  //     await factoryToken.removeFromAllowedToken(address1);
  //     expect(await factoryToken.getAllowedToken(address1)).to.be.false;
  //     expect(await factoryToken.getAllowedToken(address3)).to.be.true;
  //     await factoryToken.removeFromAllowedToken(address3);
  //     expect(await factoryToken.getAllowedToken(address3)).to.be.false;
  //     // console.log(await factoryToken.getAllowedTokens());
  //   });

  //   it('Set functions', async() => {
  //     const TestBridge = await ethers.getContractFactory("WrappedERC20");
  //     testBridge = await TestBridge.deploy();
  //     expect(await factoryToken.bridge()).to.be.equal(bridgeMock.address);
  //     await factoryToken.setBridge(testBridge.address);
  //     expect(await factoryToken.bridge()).to.be.equal(testBridge.address);

  //     const TestWrappedERC20 = await ethers.getContractFactory("WrappedERC20");
  //     testTokenStandart = await TestWrappedERC20.deploy();
  //     expect(await factoryToken.bridgeTokenStandard()).to.be.equal(tokenStandart.address);
  //     await factoryToken.setWrappedERC20(testTokenStandart.address);
  //     expect(await factoryToken.bridgeTokenStandard()).to.be.equal(testTokenStandart.address);
  //   });
  // });

  // describe("Checking admin functions", function () {

  //   it('Set functions', async() => {
  //     const TestBridge = await ethers.getContractFactory("WrappedERC20");
  //     testBridge = await TestBridge.deploy();
  //     expect(await factoryToken.bridge()).to.be.equal(bridgeMock.address);
  //     await expect(factoryToken.connect(client).setBridge(testBridge.address))
  //         .to.be.revertedWith("onlyAdmin");
  //     expect(await factoryToken.bridge()).to.be.equal(bridgeMock.address);

  //     const TestWrappedERC20 = await ethers.getContractFactory("WrappedERC20");
  //     testTokenStandart = await TestWrappedERC20.deploy();
  //     expect(await factoryToken.bridgeTokenStandard()).to.be.equal(tokenStandart.address);
  //     await expect(factoryToken.connect(client).setWrappedERC20(testTokenStandart.address))
  //         .to.be.revertedWith("onlyAdmin");
  //     expect(await factoryToken.bridgeTokenStandard()).to.be.equal(tokenStandart.address);
  //   });

  //   it('Create functions', async() => {
  //     await expect(factoryToken.connect(client).createNewToken("Test Token 1", "TT1", 8))
  //         .to.be.revertedWith("onlyAdmin");
  //   });
  //   it('Create functions', async() => {
  //     await factoryToken.createNewToken("Test Token 1", "TT1", 8);
  //     await factoryToken.createNewToken("Test Token 2", "TT2", 18);
  //     await factoryToken.createNewToken("Test Token 3", "TT3", 8);
  //     await factoryToken.createNewToken("Test Token 4", "TT4", 18);
  //     [address1, address2, address3, address4] = await factoryToken.getAllowedTokens();
  //     // console.log(await factoryToken.getAllowedTokens());
  //     expect(await factoryToken.getAllowedToken(address1)).to.be.true;
  //     await expect(factoryToken.connect(client).removeFromAllowedToken(address1))
  //         .to.be.revertedWith("onlyAdmin");
  //     expect(await factoryToken.getAllowedToken(address1)).to.be.true;
  //   });
  // });

  // describe("Checking ERC20 functions", function () {
  //   it('Mint function', async() => {
  //     decimals = BigNumber.from(10).pow(18);
  //     var mintAmount = BigNumber.from(500).mul(decimals);

  //     await factoryToken.createNewToken("Test Token 1", "TT1", 8);

  //     [address1] = await factoryToken.getAllowedTokens();
  //     nt1 = await ethers.getContractAt('IWrappedERC20', address1);

  //     expect(await nt1.balanceOf(client.address)).to.be.equal(0);
  //     await bridgeMock.mint(client.address, mintAmount, nt1.address);
  //     expect(await nt1.balanceOf(client.address)).to.be.equal(mintAmount);
  //   });
  //   it('Burn function', async() => {
  //     decimals = BigNumber.from(10).pow(18);
  //     var mintAmount = BigNumber.from(500).mul(decimals);

  //     await factoryToken.createNewToken("Test Token 1", "TT1", 8);

  //     [address1] = await factoryToken.getAllowedTokens();
  //     nt1 = await ethers.getContractAt('IWrappedERC20', address1);

  //     expect(await nt1.balanceOf(client.address)).to.be.equal(0);
  //     await bridgeMock.mint(client.address, mintAmount, nt1.address);
  //     expect(await nt1.balanceOf(client.address)).to.be.equal(mintAmount);

  //     await bridgeMock.connect(client).burn(client.address, mintAmount, nt1.address);
  //     expect(await nt1.balanceOf(client.address)).to.be.equal(0);
  //   });
  // });
  });

});
