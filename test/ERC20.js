// SPDX-License-Identifier: MIT

const { ethers } = require("hardhat");
const { expect } = require("chai");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");


describe('ERC20 Token', () => {

  let token;

  // Deploy all contracts before each test suite
  beforeEach( async () => {
  	[ownerAcc, clientAcc1, clientAcc2, bridgeAcc] = await ethers.getSigners();

  	let tokenTx = await ethers.getContractFactory("WrappedERC20");
    token = await tokenTx.deploy();

    await token.deployed();
    // Explicitly set provider address here instead of bridge contract address
    await token.initialize("Integral", "SFXDX", 18, bridgeAcc.address);

  });


  it('Should have correct name, symbol and decimals', async() => {
  	expect(await token.name()).to.equal("Integral");
  	expect(await token.symbol()).to.equal("SFXDX");
  	expect(await token.decimals()).to.equal(18);
  });

  it('Should only mint tokens if caller is a bridge', async() => {
  	let amount = ethers.utils.parseUnits("10", 18);

  	// Call from a client should fail
    await expect(token.connect(clientAcc1).mint(clientAcc2.address, amount))
  	.to.be.revertedWith("Token: caller is not a bridge!");

  	// Call from a bridge should secceed
  	await expect(token.connect(bridgeAcc).mint(clientAcc1.address, amount))
  	.to.emit(token, "Mint")
  	.withArgs(anyValue, amount);
  });

  it('Should only burn tokens if caller is a bridge', async() => {
  	let amount = ethers.utils.parseUnits("10", 18);
  	// First mint some tokens to the client
  	await expect(token.connect(bridgeAcc).mint(clientAcc1.address, amount))
  	.to.emit(token, "Mint")
  	.withArgs(anyValue, amount);

  	// Call from a client should fail
    await expect(token.connect(clientAcc2).burn(clientAcc1.address, amount))
  	.to.be.revertedWith("Token: caller is not a bridge!");

    // Call from a bridge should secceed
    await expect(token.connect(bridgeAcc).burn(clientAcc1.address, amount))
  	.to.emit(token, "Burn")
  	.withArgs(anyValue, amount);
  });

  it('Should return correct address of the bridge', async() => {
  	expect(await token.bridge()).to.equal(bridgeAcc.address);
  	
  });  
});
