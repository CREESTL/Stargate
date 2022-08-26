// SPDX-License-Identifier: MIT

const { ethers } = require("hardhat");
const { expect } = require("chai");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");


describe('ERC1155 Token', () => {

  let token;
  const tokenUri = "https://someUriString.com";
  const tokenId = 777;
  const amount = 10;
  const ids = [1, 2, 3];
  const amounts = [10, 20, 30];

  // Deploy all contracts before each test suite
  beforeEach( async () => {
  	[ownerAcc, clientAcc1, clientAcc2, bridgeAcc] = await ethers.getSigners();

  	let tokenTx = await ethers.getContractFactory("WrappedERC1155");
    token = await tokenTx.deploy();
    await token.deployed();

    // Explicitly set provider address here instead of bridge contract address
    await token.initialize(tokenUri, bridgeAcc.address);

  });


  it('Should have correct uri', async() => {
  	expect(await token.tokensUri()).to.equal(tokenUri);
  });

  it('Should only mint tokens if caller is a bridge', async() => {

  	// Call from a client should fail
    await expect(token.connect(clientAcc1).mint(clientAcc1.address, tokenId, amount))
  	.to.be.revertedWith("Token: caller is not a bridge!");

  	// Call from a bridge should secceed
    expect(await token.balanceOf(clientAcc1.address, tokenId)).to.equal(0);
  	await expect(token.connect(bridgeAcc).mint(clientAcc1.address, tokenId, amount))
  	.to.emit(token, "Mint");
    expect(await token.balanceOf(clientAcc1.address, tokenId)).to.equal(amount);


    // Do the same with batches
    await expect(token.connect(clientAcc1).mintBatch(clientAcc1.address, ids, amounts))
    .to.be.revertedWith("Token: caller is not a bridge!");

    expect(await token.balanceOf(clientAcc1.address, ids[0])).to.equal(0);
    expect(await token.balanceOf(clientAcc1.address, ids[1])).to.equal(0);
    expect(await token.balanceOf(clientAcc1.address, ids[2])).to.equal(0);
    await expect(token.connect(bridgeAcc).mintBatch(clientAcc1.address, ids, amounts))
    .to.emit(token, "MintBatch");
    expect(await token.balanceOf(clientAcc1.address, ids[0])).to.equal(amounts[0]);
    expect(await token.balanceOf(clientAcc1.address, ids[1])).to.equal(amounts[1]);
    expect(await token.balanceOf(clientAcc1.address, ids[2])).to.equal(amounts[2]);
  });

  it('Should only burn tokens if caller is a bridge', async() => {

  	// First mint some tokens to the client
  	await expect(token.connect(bridgeAcc).mint(clientAcc1.address, tokenId, amount))
  	.to.emit(token, "Mint");

  	// Call from a client should fail
    await expect(token.connect(clientAcc2).burn(clientAcc1.address, tokenId, amount))
  	.to.be.revertedWith("Token: caller is not a bridge!");

    // Call from a bridge should secceed
    expect(await token.balanceOf(clientAcc1.address, tokenId)).to.equal(amount);
    await expect(token.connect(bridgeAcc).burn(clientAcc1.address, tokenId, amount))
  	.to.emit(token, "Burn");
    expect(await token.balanceOf(clientAcc1.address, tokenId)).to.equal(0);

    // Do the same with batches
    await expect(token.connect(bridgeAcc).mintBatch(clientAcc1.address, ids, amounts))
    .to.emit(token, "MintBatch");

    await expect(token.connect(clientAcc2).burn(clientAcc1.address, ids, amounts))
    .to.be.revertedWith("Token: caller is not a bridge!");

    expect(await token.balanceOf(clientAcc1.address, ids[0])).to.equal(amounts[0]);
    expect(await token.balanceOf(clientAcc1.address, ids[1])).to.equal(amounts[1]);
    expect(await token.balanceOf(clientAcc1.address, ids[2])).to.equal(amounts[2]);
    await expect(token.connect(bridgeAcc).burnBatch(clientAcc1.address, ids, amounts))
    .to.emit(token, "BurnBatch");
    expect(await token.balanceOf(clientAcc1.address, ids[0])).to.equal(0);
    expect(await token.balanceOf(clientAcc1.address, ids[1])).to.equal(0);
    expect(await token.balanceOf(clientAcc1.address, ids[2])).to.equal(0);
  });

  it('Should return correct address of the bridge', async() => {
  	expect(await token.bridge()).to.equal(bridgeAcc.address);
  	
  });  
});

describe("ERC1155 Token extras", async () => {
  const addressZero = "0x0000000000000000000000000000000000000000";
  it('Should fail to initialize with wrong arguments', async() => {
    [ownerAcc, clientAcc1, clientAcc2, bridgeAcc] = await ethers.getSigners();

    let tokenTx = await ethers.getContractFactory("WrappedERC1155");
    token = await tokenTx.deploy();

    await token.deployed();
    
    await expect(token.initialize("", bridgeAcc.address))
    .to.be.revertedWith("ERC1155: initial token URI can not be empty!");

    await expect(token.initialize("IAMTOKENURI", addressZero))
    .to.be.revertedWith("ERC1155: initial bridge address can not be a zero address!");
  }); 
});