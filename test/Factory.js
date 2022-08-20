// SPDX-License-Identifier: MIT

const { ethers } = require("hardhat");
const { expect } = require("chai");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");


describe('Factory', () => {

  // Constants to be used afterwards
  let token;
  let factory;
  let bridge;
  const addressZero = "0x0000000000000000000000000000000000000000";

  beforeEach( async () => {
    [owner, client, acc3, acc4, bridge] = await ethers.getSigners();
    let tokenTx = await ethers.getContractFactory("WrappedERC20");
    let factoryTx = await ethers.getContractFactory("WrappedERC20Factory");
    let bridgeTx = await ethers.getContractFactory("Bridge");
    // Owner is a bot messenger. Fee rate is 1%
    bridge = await bridgeTx.deploy(owner.address, 100);
    token = await tokenTx.deploy();
    factory = await factoryTx.deploy();

    await token.deployed();
    await token.initialize("Integral", "SFXDX", 18, bridge.address);
    await factory.deployed();
    await bridge.deployed();

  });

  describe("Factory", function () {

    it('Should create a new token', async() => {
      await expect(factory.createNewToken("ETH", acc3.address, "Integral", "SFXDX", 18, bridge.address)).to.emit(factory, "CreateNewToken")
        .withArgs("ETH", acc3.address, "Integral", anyValue); // anyValue is used because token address in unknown
    });

    it('Should fail to create two identical contracts', async() => {
      // Create the token
      await factory.createNewToken("ETH", acc3.address, "Integral", "SFXDX", 18, bridge.address);
      // Try to create the same token
      await expect(factory.createNewToken("ETH", acc3.address, "Integral", "SFXDX", 18, bridge.address)).
        to.be.revertedWith("Factory: wrapped token already exists!");
    });

    it('Should fail to find original chain and token address for a fake token', async() => {
      // Use an address of non-existing token
      await expect(factory.getOriginalToken(acc3.address)).to.be.revertedWith("Factory: no original token found for a wrapped token!");

    });

    it('Should find original chain and token address', async() => {
      // Deploy a new token
      await factory.createNewToken("ETH", acc3.address, "Integral", "SFXDX", 18, bridge.address);
      // Get this token's address
      let tokenAddress = await factory.getWrappedAddress("Integral");
      // Check original chain and address
      let [originalChain, originalAddress] = await factory.getOriginalToken(tokenAddress);
      expect(originalChain).to.equal("ETH");
      expect(originalAddress).to.equal(acc3.address);
    });

    it('Should fail to find wrapped token if it was not created', async() => {
      // Use an address of non-existing token
      expect(await factory.checkTargetToken(acc3.address)).to.equal(false);
    });

    it('Should fail to find the address of a wrapped token with a fake name', async() => {
      await expect(factory.getWrappedAddress("IAMNOTATOKEN")).
        to.be.revertedWith("Factory: no wrapped token with this name!");
    });

    it('Should revert with invalid arguments', async() => {

      await expect(factory.createNewToken("", acc3.address, "Integral", "SFXDX", 18, bridge.address)).
        to.be.revertedWith("Factory: chain name is too short!");
      await expect(factory.createNewToken("ETH", acc3.address, "", "SFXDX", 18, bridge.address)).
        to.be.revertedWith("Factory: new token name is too short!");
      await expect(factory.createNewToken("ETH", acc3.address, "Integral", "", 18, bridge.address)).
        to.be.revertedWith("Factory: new token symbol is too short!");
      await expect(factory.createNewToken("ETH", acc3.address, "Integral", "SFXDX", 0, bridge.address)).
        to.be.revertedWith("Factory: invalid decimals!");
      await expect(factory.createNewToken("ETH", acc3.address, "Integral", "SFXDX", 18, addressZero)).
        to.be.revertedWith("Factory: bridge can not have a zero address!");

      await expect(factory.checkTargetToken(addressZero)).
        to.be.revertedWith("Factory: original token can not have a zero address!");  

      await expect(factory.getOriginalToken(addressZero)).
        to.be.revertedWith("Factory: wrapped token can not have a zero address!");

      await expect(factory.getWrappedAddress("")).
        to.be.revertedWith("Factory: token name is too short!");    

    });
  });
});
