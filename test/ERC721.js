// SPDX-License-Identifier: MIT

const { ethers } = require("hardhat");
const { expect } = require("chai");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");


describe('ERC721 Token', () => {

  const tokenId = 777;
  let token;

  // Deploy all contracts before each test suite
  beforeEach( async () => {
  	[ownerAcc, clientAcc1, clientAcc2, bridgeAcc] = await ethers.getSigners();

  	let tokenTx = await ethers.getContractFactory("WrappedERC721");

    token = await tokenTx.deploy();

    await token.deployed();
    // Explicitly set provider address here instead of bridge contract address
    await token.initialize("Integral", "SFXDX", bridgeAcc.address);

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
    expect(await token.balanceOf(clientAcc1.address)).to.equal(0);
  	await expect(token.connect(bridgeAcc).mint(clientAcc1.address, tokenId))
  	.to.emit(token, "Mint");
    expect(await token.balanceOf(clientAcc1.address)).to.equal(1);

  });

  it('Should only burn tokens if caller is a bridge', async() => {

  	// First mint some tokens to the client
  	await expect(token.connect(bridgeAcc).mint(clientAcc1.address, tokenId))
  	.to.emit(token, "Mint");

  	// Call from a client should fail
    await expect(token.connect(clientAcc2).burn(tokenId))
  	.to.be.revertedWith("Token: caller is not a bridge!");

    // Call from a bridge should secceed
    expect(await token.balanceOf(clientAcc1.address)).to.equal(1);
    await expect(token.connect(bridgeAcc).burn(tokenId))
  	.to.emit(token, "Burn");
    expect(await token.balanceOf(clientAcc1.address)).to.equal(0);

  });

  it('Should return correct address of the bridge', async() => {
  	expect(await token.bridge()).to.equal(bridgeAcc.address);
  	
  });  
});

describe("ERC721 Token extras", async () => {
  const addressZero = "0x0000000000000000000000000000000000000000";
  it('Should fail to initialize with wrong arguments', async() => {
    [ownerAcc, clientAcc1, clientAcc2, bridgeAcc] = await ethers.getSigners();

    let tokenTx = await ethers.getContractFactory("WrappedERC721");
    token = await tokenTx.deploy();

    await token.deployed();
    
    await expect(token.initialize("", "SFXDX", bridgeAcc.address))
    .to.be.revertedWith("ERC721: initial token name can not be empty!");

    await expect(token.initialize("Integral", "", bridgeAcc.address))
    .to.be.revertedWith("ERC721: initial token symbol can not be empty!");

    await expect(token.initialize("Integral", "SFXDX", addressZero))
    .to.be.revertedWith("ERC721: initial bridge address can not be a zero address!");
  }); 
});