// SPDX-License-Identifier: MIT

const { ethers } = require("hardhat");
const { expect } = require("chai");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");


describe('ERC721 Token', () => {

  let tokenId;
  let token;

  // Deploy all contracts before each test suite
  beforeEach( async () => {
  	[ownerAcc, clientAcc1, clientAcc2, bridgeAcc] = await ethers.getSigners();

  	let tokenTx = await ethers.getContractFactory("WrappedERC721");

    token = await tokenTx.deploy();

    await token.deployed();
    // Explicitly set provider address here instead of bridge contract address
    await token.initialize("Integral", "SFXDX", bridgeAcc.address);

    tokenId = 777;

  });


  it('Should have correct name and symbol symbol', async() => {
  	expect(await token.name()).to.equal("Integral");
  	expect(await token.symbol()).to.equal("SFXDX");
  });

  it('Should only mint tokens if caller is a bridge', async() => {

  	// Call from a client should fail
    await expect(token.connect(clientAcc1).mint(clientAcc1.address, tokenId))
  	.to.be.revertedWith("Token: caller is not a bridge!");

  	// Call from a bridge should secceed
  	await expect(token.connect(bridgeAcc).mint(clientAcc1.address, tokenId))
  	.to.emit(token, "Mint");
  });

  it('Should only burn tokens if caller is a bridge', async() => {

  	// First mint some tokens to the client
  	await expect(token.connect(bridgeAcc).mint(clientAcc1.address, tokenId))
  	.to.emit(token, "Mint");

  	// Call from a client should fail
    await expect(token.connect(clientAcc2).burn(tokenId))
  	.to.be.revertedWith("Token: caller is not a bridge!");

    // Call from a bridge should secceed
    await expect(token.connect(bridgeAcc).burn(tokenId))
  	.to.emit(token, "Burn");

  });

  it('Should return correct address of the bridge', async() => {
  	expect(await token.bridge()).to.equal(bridgeAcc.address);
  	
  });  
});
