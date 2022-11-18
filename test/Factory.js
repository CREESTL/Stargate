// SPDX-License-Identifier: MIT

const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");


describe('Factory', () => {

  // Constants to be used afterwards
  let token;
  let factory;
  let bridge;
  const addressZero = "0x0000000000000000000000000000000000000000";
  const tokenUri = "SomeTokenUri";

  beforeEach( async () => {
    [owner, client, acc3, acc4, bridge] = await ethers.getSigners();
    let token20Tx = await ethers.getContractFactory("WrappedERC20");
    let token721Tx = await ethers.getContractFactory("WrappedERC721");
    let token1155Tx = await ethers.getContractFactory("WrappedERC1155");

    token20 = await token20Tx.deploy();
    await token20.deployed();
    await token20.initialize("Integral", "SFXDX", 18, bridge.address);
    token721 = await token721Tx.deploy();
    await token721.deployed();
    await token721.initialize("Integral", "SFXDX", bridge.address);
    token1155 = await token1155Tx.deploy();
    await token1155.deployed();
    await token1155.initialize("IAMTOKEN", bridge.address);

    let factoryTx = await ethers.getContractFactory("WrappedTokenFactory");
    factory = await upgrades.deployProxy(
      factoryTx,
      [
        token20.address,
        token721.address,
        token1155.address
      ],
      {initializer:'initialize'}
    );

    let bridgeTx = await ethers.getContractFactory("Bridge");
    bridge = await upgrades.deployProxy(
      bridgeTx,
      [
        owner.address,
        owner.address,
        owner.address,
        "Ala"
      ],
      {initializer:'initialize'}
    );
    // Owner is a bot messenger. Fee rate is 1%
    await factory.deployed();
    await bridge.deployed();

  });

  describe("Token Creation", async () => {
    it('Should create a new ERC20 token', async() => {
      await expect(factory.createERC20Token("ETH", acc3.address, "Integral", "SFXDX", 18, bridge.address)).to.emit(factory, "CreateERC20Token")
        .withArgs("ETH", acc3.address, "Integral", anyValue); // anyValue is used because token address in unknown
    });

    it('Should fail to create two identical ERC20 tokens', async() => {
      // Create the token
      await factory.createERC20Token("ETH", acc3.address, "Integral", "SFXDX", 18, bridge.address);
      // Try to create the same token
      await expect(factory.createERC20Token("ETH", acc3.address, "Integral", "SFXDX", 18, bridge.address)).
        to.be.revertedWith("Factory: wrapped ERC20 token already exists!");
    });

    it('Should create a new ERC721 token', async() => {
      await expect(await factory.createERC721Token("ETH", acc3.address, "Integral", "SFXDX", bridge.address)).to.emit(factory, "CreateERC721Token")
        .withArgs("ETH", acc3.address, "Integral", anyValue); // anyValue is used because token address in unknown
    });

    it('Should fail to create two identical ERC721 tokens', async() => {
      // Create the token
      await factory.createERC721Token("ETH", acc3.address, "Integral", "SFXDX", bridge.address);
      // Try to create the same token
      await expect(factory.createERC721Token("ETH", acc3.address, "Integral", "SFXDX", bridge.address)).
        to.be.revertedWith("Factory: wrapped ERC721 token already exists!");
    });

    it('Should create a new ERC1155 token', async() => {
      await expect(factory.createERC1155Token("ETH", acc3.address, tokenUri,  bridge.address)).to.emit(factory, "CreateERC1155Token")
        .withArgs("ETH", acc3.address, tokenUri, anyValue); // anyValue is used because token address in unknown
    });

    it('Should fail to create two identical ERC1155 tokens', async() => {
      // Create the token
      await factory.createERC1155Token("ETH", acc3.address, tokenUri,  bridge.address);
      // Try to create the same token
      await expect(factory.createERC1155Token("ETH", acc3.address, tokenUri,  bridge.address)).
        to.be.revertedWith("Factory: wrapped ERC1155 token already exists!");
    });
  });

  describe("Token Search", async () => {
    it('Should find wrapped token ', async() => {
      // Create the token
      await factory.createERC20Token("ETH", acc3.address, "Integral", "SFXDX", 18, bridge.address);
      // Use an address of non-existing token
      expect(await factory.checkTargetToken(acc3.address)).to.equal(true);
    });

    it('Should fail to find wrapped token if it was not created', async() => {
      // Use an address of non-existing token
      expect(await factory.checkTargetToken(acc3.address)).to.equal(false);
    });

    it('Should find the address of a wrapped token by its name', async() => {
      await factory.createERC20Token("ETH", acc3.address, "Integral", "SFXDX", 18, bridge.address);
      expect(factory.getWrappedAddressByName("Integral")).not.to.be.reverted;

    });

    it('Should fail to find the address of a wrapped token with a fake name', async() => {
      await expect(factory.getWrappedAddressByName("IAMNOTATOKEN")).
        to.be.revertedWith("Factory: no wrapped token with this name!");
    });

    it('Should find the address of a wrapped token by its URI', async() => {
      await factory.createERC1155Token("ETH", acc3.address, tokenUri,  bridge.address);
      expect(factory.getWrappedAddressByUri(tokenUri)).not.to.be.reverted;
    });

    it('Should fail to find the address of a wrapped token with a fake URI', async() => {
      await expect(factory.getWrappedAddressByUri("IAMFAKEURI")).
        to.be.revertedWith("Factory: no wrapped token with this URI!");
    });

    it('Should find original chain and token address', async() => {
      // Deploy a new token
      await factory.createERC20Token("ETH", acc3.address, "Integral", "SFXDX", 18, bridge.address);
      // Get this token's address
      let tokenAddress = await factory.getWrappedAddressByName("Integral");
      // Check original chain and address
      let [originalChain, originalAddress] = await factory.getOriginalToken(tokenAddress);
      expect(originalChain).to.equal("ETH");
      expect(originalAddress).to.equal(acc3.address);
    });

    it('Should fail to find original chain and token address for a fake token', async() => {
      // Use an address of non-existing token
      await expect(factory.getOriginalToken(acc3.address)).to.be.revertedWith("Factory: no original token found for a wrapped token!");

    });
  });

  describe("Arguments", async() => {
    it('Should revert with invalid arguments', async() => {

      await expect(factory.createERC20Token("", acc3.address, "Integral", "SFXDX", 18, bridge.address)).
        to.be.revertedWith("Factory: chain name is too short!");
      await expect(factory.createERC20Token("ETH", acc3.address, "", "SFXDX", 18, bridge.address)).
        to.be.revertedWith("Factory: new token name is too short!");
      await expect(factory.createERC20Token("ETH", acc3.address, "Integral", "", 18, bridge.address)).
        to.be.revertedWith("Factory: new token symbol is too short!");
      await expect(factory.createERC20Token("ETH", acc3.address, "Integral", "SFXDX", 0, bridge.address)).
        to.be.revertedWith("Factory: invalid decimals!");
      await expect(factory.createERC20Token("ETH", acc3.address, "Integral", "SFXDX", 18, addressZero)).
        to.be.revertedWith("Factory: bridge can not have a zero address!");

      await expect(factory.createERC721Token("", acc3.address, "Integral", "SFXDX", bridge.address)).
        to.be.revertedWith("Factory: chain name is too short!");
      await expect(factory.createERC721Token("ETH", acc3.address, "", "SFXDX", bridge.address)).
        to.be.revertedWith("Factory: new token name is too short!");
      await expect(factory.createERC721Token("ETH", acc3.address, "Integral", "", bridge.address)).
        to.be.revertedWith("Factory: new token symbol is too short!");
      await expect(factory.createERC721Token("ETH", acc3.address, "Integral", "SFXDX", addressZero)).
        to.be.revertedWith("Factory: bridge can not have a zero address!");

      await expect(factory.createERC1155Token("", acc3.address, tokenUri, bridge.address)).
        to.be.revertedWith("Factory: chain name is too short!");
      await expect(factory.createERC1155Token("ETH", acc3.address, "", bridge.address)).
        to.be.revertedWith("Factory: new token URI is too short!");
      await expect(factory.createERC1155Token("ETH", acc3.address, tokenUri, addressZero)).
        to.be.revertedWith("Factory: bridge can not have a zero address!");

      await expect(factory.checkTargetToken(addressZero)).
        to.be.revertedWith("Factory: original token can not have a zero address!");  

      await expect(factory.getOriginalToken(addressZero)).
        to.be.revertedWith("Factory: wrapped token can not have a zero address!");

      await expect(factory.getWrappedAddressByName("")).
        to.be.revertedWith("Factory: token name is too short!");    

      await expect(factory.getWrappedAddressByUri("")).
        to.be.revertedWith("Factory: token URI is too short!");  
    });  
  });
});
