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
  	await expect(token.connect(bridgeAcc).mint(clientAcc1.address, tokenId, amount))
  	.to.emit(token, "Mint");

    // Do the same with batches
    await expect(token.connect(clientAcc1).mintBatch(clientAcc1.address, ids, amounts))
    .to.be.revertedWith("Token: caller is not a bridge!");

    await expect(token.connect(bridgeAcc).mintBatch(clientAcc1.address, ids, amounts))
    .to.emit(token, "MintBatch");
  });

  it('Should only burn tokens if caller is a bridge', async() => {

  	// First mint some tokens to the client
  	await expect(token.connect(bridgeAcc).mint(clientAcc1.address, tokenId, amount))
  	.to.emit(token, "Mint");

  	// Call from a client should fail
    await expect(token.connect(clientAcc2).burn(clientAcc1.address, tokenId, amount))
  	.to.be.revertedWith("Token: caller is not a bridge!");

    // Call from a bridge should secceed
    await expect(token.connect(bridgeAcc).burn(clientAcc1.address, tokenId, amount))
  	.to.emit(token, "Burn");

    // Do the same with batches
    await expect(token.connect(bridgeAcc).mintBatch(clientAcc1.address, ids, amounts))
    .to.emit(token, "MintBatch");

    await expect(token.connect(clientAcc2).burn(clientAcc1.address, ids, amounts))
    .to.be.revertedWith("Token: caller is not a bridge!");

    await expect(token.connect(bridgeAcc).burnBatch(clientAcc1.address, ids, amounts))
    .to.emit(token, "BurnBatch");
  });

  it('Should return correct address of the bridge', async() => {
  	expect(await token.bridge()).to.equal(bridgeAcc.address);
  	
  });  
});
