// SPDX-License-Identifier: MIT

const { ethers } = require("hardhat");
const { expect } = require("chai");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const { 
  getSignatureFromDigestNative,
  getPermitDigestNative, 
  getDomainSeparatorNative, 
  getPermitTypeHashNative,
  getSignatureFromDigestERC20,
  getPermitDigestERC20, 
  getDomainSeparatorERC20, 
  getPermitTypeHashERC20,
  getSignatureFromDigestERC721,
  getPermitDigestERC721, 
  getDomainSeparatorERC721, 
  getPermitTypeHashERC721,
  getSignatureFromDigestERC1155,
  getPermitDigestERC1155, 
  getDomainSeparatorERC1155, 
  getPermitTypeHashERC1155
} = require("./utils/sign");


const {boolean} = require("hardhat/internal/core/params/argumentTypes");

describe('Bridge', () => {
	
	// Constants to be used afterwards
	let tokenERC20;
  let tokenERC721;
  let tokenERC1155;
	let bridge;
	const addressZero = "0x0000000000000000000000000000000000000000";

  // Default Chain ID for Hardhat local network
  const chainId = 31337;

  // Imitate the BOT_MESSENGER role using a wallet generated from mnemonic
  let mnemonic = "announce room limb pattern dry unit scale effort smooth jazz weasel alcohol";
  let botMessenger = ethers.Wallet.fromMnemonic(mnemonic);

  let provider = ethers.provider;

  // Deploy all contracts before each test suite
  beforeEach( async () => {
  	[ownerAcc, clientAcc1, clientAcc2] = await ethers.getSigners();

  	let tokenERC20Tx = await ethers.getContractFactory("WrappedERC20");
    let tokenERC721Tx = await ethers.getContractFactory("WrappedERC721");
    let tokenERC1155Tx = await ethers.getContractFactory("WrappedERC1155");

  	let bridgeTx = await ethers.getContractFactory("Bridge");

    // Owner is a bot messenger. 
    bridge = await bridgeTx.deploy(botMessenger.address);
    tokenERC20 = await tokenERC20Tx.deploy();
    tokenERC721 = await tokenERC721Tx.deploy();
    tokenERC1155 = await tokenERC1155Tx.deploy();

    await tokenERC20.deployed();
    await tokenERC20.initialize("Integral", "SFXDX", 18, bridge.address);

    await tokenERC721.deployed();
    await tokenERC721.initialize("Integral", "SFXDX", bridge.address);

    await tokenERC1155.deployed();
    await tokenERC1155.initialize("IAMTOKENURI", bridge.address);

    await bridge.deployed();

  });

  /**
   * Logic for each token type test
   * - Mint (if possible)
   * - Fail to mint (if possible)
   * - Lock and unlock
   * - Fail to lock
   * - Fail to unlock
   * - Burn (if possible)
   * - Fail to burn (if possible)
   */

  describe("Native Tokens", () => {

  	it('Should lock and unlock native tokens', async() => {

  		let amount = ethers.utils.parseEther('1');
  		let fee = await bridge.calcFee(amount);
  		let sum = amount.add(fee);

  		await bridge.setSupportedChain("Ala");

      // Transfer ether to the bridge and lock it there
      await expect(bridge.lockNative(amount, clientAcc1.address, "Ala", {value: sum}))
      .to.emit(bridge, "LockNative")
      // First two parameters are indexed (hashed) in the event, so their value is uknown 
      .withArgs(anyValue, anyValue, amount, "Ala");

      // Unlock locked tokens
      // NOTE We have to provide token name "Native" for **any** native token
      let domainSeparator = getDomainSeparatorNative("Native", '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashNative(clientAcc1.address, amount, 0)
      let permitDigest = getPermitDigestNative(domainSeparator, typeHash);
      let signature = getSignatureFromDigestNative(permitDigest, botMessenger);

      await expect(bridge.connect(clientAcc1).unlockWithPermitNative(
      	amount,
      	0,
      	signature.v,
      	signature.r,
      	signature.s
      	)).to.emit(bridge, "UnlockWithPermitNative").withArgs(anyValue, amount);
    });

  	it('Should fail to lock native tokens if not enough tokens were sent', async() => {

  		let amount = ethers.utils.parseEther('1');
  		let fee = await bridge.calcFee(amount);
  		let sum = amount.add(fee);

  		await bridge.setSupportedChain("Ala");

      // Set `value` to less than `sum`
      await expect(bridge.lockNative(amount, clientAcc1.address, "Ala", {value: sum.div(2)}))
      .to.be.revertedWith("Bridge: not enough native tokens were sent to cover the fees!");
    });

  	it('Should fail to unlock native tokens if not enough tokens on the bridge', async() => {

  		let amount = ethers.utils.parseEther('1');
  		let fee = await bridge.calcFee(amount);
  		let sum = amount.add(fee);

      // We did not provide the bridge with any native tokens so far. So it can not send them back
      let domainSeparator = getDomainSeparatorNative("Native", '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashNative(clientAcc1.address, amount, 0)
      let permitDigest = getPermitDigestNative(domainSeparator, typeHash);
      let signature = getSignatureFromDigestNative(permitDigest, botMessenger);

      await expect(bridge.connect(clientAcc1).unlockWithPermitNative(
      	amount,
      	0,
      	signature.v,
      	signature.r,
      	signature.s
      	)).to.be.revertedWith("Bridge: not enough native tokens on the bridge balance!");
    });


    it('Should fail to unlock same native tokens twice', async() => {

      let amount = ethers.utils.parseEther('1');
      let fee = await bridge.calcFee(amount);
      let sum = amount.add(fee);

      await bridge.setSupportedChain("Ala");

      // Transfer ether to the bridge and lock it there
      await expect(bridge.lockNative(amount, clientAcc1.address, "Ala", {value: sum.mul(5)}))
      .to.emit(bridge, "LockNative")
      // First two parameters are indexed (hashed) in the event, so their value is uknown 
      .withArgs(anyValue, anyValue, amount, "Ala");

      // We did not provide the bridge with any native tokens so far. So it can not send them back
      let domainSeparator = getDomainSeparatorNative("Native", '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashNative(clientAcc1.address, amount, 0)
      let permitDigest = getPermitDigestNative(domainSeparator, typeHash);
      let signature = getSignatureFromDigestNative(permitDigest, botMessenger);

      await bridge.connect(clientAcc1).unlockWithPermitNative(
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
        );

      // Use the same nonce here
      await expect(bridge.connect(clientAcc1).unlockWithPermitNative(
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
        )).to.be.revertedWith("Bridge: request already processed!");
    });

    it('Should fail to unlock native tokens with invalid signature', async() => {

      let amount = ethers.utils.parseEther('1');
      let fee = await bridge.calcFee(amount);
      let sum = amount.add(fee);

      await bridge.setSupportedChain("Ala");

      // Transfer ether to the bridge and lock it there
      await expect(bridge.lockNative(amount, clientAcc1.address, "Ala", {value: sum}))
      .to.emit(bridge, "LockNative")
      // First two parameters are indexed (hashed) in the event, so their value is uknown 
      .withArgs(anyValue, anyValue, amount, "Ala");

      // We did not provide the bridge with any native tokens so far. So it can not send them back
      let domainSeparator = getDomainSeparatorNative("Native", '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashNative(clientAcc1.address, amount, 1)
      let permitDigest = getPermitDigestNative(domainSeparator, typeHash);
      let signature = getSignatureFromDigestNative(permitDigest, botMessenger);

      await expect(bridge.connect(clientAcc1).unlockWithPermitNative(
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
        )).to.be.revertedWith("Bridge: invalid signature!");
    });

  });

  describe("ERC20 Tokens", () => {

  	it('Should mint ERC20 tokens to users', async() => {

  		let amount = ethers.utils.parseUnits("10", 12);

      // The only way to mint bridge tokens is to use `mintWithPermitERC20` method but it requires 
      // a signature
      let domainSeparator = getDomainSeparatorERC20((await tokenERC20.name()), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC20(clientAcc1.address, amount, 0)
      let permitDigest = getPermitDigestERC20(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC20(permitDigest, botMessenger);

      expect(await tokenERC20.balanceOf(clientAcc1.address)).to.equal(0);

      await expect(bridge.connect(clientAcc1).mintWithPermitERC20(
      	tokenERC20.address,
      	amount,
      	0,
      	signature.v,
      	signature.r,
      	signature.s
      	)).to.emit(bridge, "MintWithPermitERC20").withArgs(tokenERC20.address, clientAcc1.address, amount);
      expect(await tokenERC20.balanceOf(clientAcc1.address)).to.equal(amount);

    });

    it('Should failt to mint ERC20 tokens with invalid signature', async() => {

      let amount = ethers.utils.parseUnits("10", 12);

      // The only way to mint bridge tokens is to use `mintWithPermitERC20` method but it requires 
      // a signature
      let domainSeparator = getDomainSeparatorERC20((await tokenERC20.name()), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC20(clientAcc1.address, amount, 1)
      let permitDigest = getPermitDigestERC20(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC20(permitDigest, botMessenger);

      await expect(bridge.connect(clientAcc1).mintWithPermitERC20(
        tokenERC20.address,
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
        )).to.be.revertedWith("Bridge: invalid signature!");

    });

  	it('Should fail to mint ERC20 tokens with the same nonce', async() => {

  		let amount = ethers.utils.parseUnits("10", 12);

      let domainSeparator = getDomainSeparatorERC20((await tokenERC20.name()), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC20(clientAcc1.address, amount, 0)
      let permitDigest = getPermitDigestERC20(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC20(permitDigest, botMessenger);
      
      await bridge.connect(clientAcc1).mintWithPermitERC20(
      	tokenERC20.address,
      	amount,
      	0,
      	signature.v,
      	signature.r,
      	signature.s
      	);

      // Try to mint with the same nonce
      await expect(bridge.connect(clientAcc1).mintWithPermitERC20(
      	tokenERC20.address,
      	amount,
        0, // Same nonce
        signature.v,
        signature.r,
        signature.s
        )).to.be.revertedWith("Bridge: request already processed!");

    });

  	it('Should lock and unlock ERC20 tokens', async() => {

  		let amount = ethers.utils.parseUnits("10", 12);
  		let fee = await bridge.calcFee(amount);

  		await bridge.setSupportedChain("Ala");

      // Let bridge transfer tokens from client to bridge
      await tokenERC20.connect(clientAcc1).increaseAllowance(bridge.address, amount);

      let domainSeparator = getDomainSeparatorERC20((await tokenERC20.name()), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC20(clientAcc1.address, amount, 0)
      let permitDigest = getPermitDigestERC20(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC20(permitDigest, botMessenger);
      
      await bridge.connect(clientAcc1).mintWithPermitERC20(
        tokenERC20.address,
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
        );

      // Lock tokens. 
      // Call from the same address as in the signature!
      await expect(await bridge.connect(clientAcc1).lockERC20(tokenERC20.address, amount, clientAcc1.address, "Ala", {value: fee}))
      .to.emit(bridge, "LockERC20")
        .withArgs(anyValue, anyValue, anyValue, amount, "Ala");

      // Unlock locked tokens
      domainSeparator = getDomainSeparatorERC20((await tokenERC20.name()), '1', chainId, bridge.address);
      typeHash = getPermitTypeHashERC20(clientAcc1.address, amount, 1)
      permitDigest = getPermitDigestERC20(domainSeparator, typeHash);
      signature = getSignatureFromDigestERC20(permitDigest, botMessenger);
       
      await expect(bridge.connect(clientAcc1).unlockWithPermitERC20(
      	tokenERC20.address,
      	amount,
      	1,
      	signature.v,
      	signature.r,
      	signature.s
      	)).to.emit(bridge, "UnlockWithPermitERC20").withArgs(anyValue, anyValue, amount);
    });

  	it('Should fail to lock ERC20 tokens if not enough native tokens were sent', async() => {

  		let amount = ethers.utils.parseEther('1');
  		let fee = await bridge.calcFee(amount);

  		await bridge.setSupportedChain("Ala");

      await tokenERC20.connect(clientAcc1).increaseAllowance(bridge.address, amount);

      // We did not provide the caller (client) with any ERC tokens so far. So the bridge can not 
      // tranfer them from user's adrress fo the bridge itself
      await expect(bridge.connect(clientAcc1).lockERC20(tokenERC20.address, amount, clientAcc1.address, "Ala", {value: fee / 2}))
      .to.be.revertedWith("Bridge: not enough native tokens were sent to cover the fees!");
    });

    it('Should fail to lock ERC20 tokens if sender does not have enough tokens', async() => {

      let amount = ethers.utils.parseEther('1');
      let fee = await bridge.calcFee(amount);

      await bridge.setSupportedChain("Ala");

      await tokenERC20.connect(clientAcc1).increaseAllowance(bridge.address, amount);

      // We did not provide the caller (client) with any ERC tokens so far. So the bridge can not 
      // tranfer them from user's adrress fo the bridge itself
      await expect(bridge.connect(clientAcc1).lockERC20(tokenERC20.address, amount, clientAcc1.address, "Ala", {value: fee}))
      .to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

  	it('Should fail to unlock ERC20 tokens if not enough tokens on the bridge', async() => {

  		let amount = ethers.utils.parseEther('1');
  		let fee = await bridge.calcFee(amount);

      // We did not provide the bridge with any native tokens so far. So it can not send them back
      domainSeparator = getDomainSeparatorERC20((await tokenERC20.name()), '1', chainId, bridge.address);
      typeHash = getPermitTypeHashERC20(clientAcc1.address, amount, 1)
      permitDigest = getPermitDigestERC20(domainSeparator, typeHash);
      signature = getSignatureFromDigestERC20(permitDigest, botMessenger);

      await expect(bridge.connect(clientAcc1).unlockWithPermitERC20(
      	tokenERC20.address,
      	amount,
      	0,
      	signature.v,
      	signature.r,
      	signature.s
      	)).to.be.revertedWith("Bridge: not enough ERC20 tokens on the bridge balance!");
    });

  	it('Should burn ERC20 tokens', async() => {

  		let amount = ethers.utils.parseUnits("10", 12);
  		let fee = await bridge.calcFee(amount);

  		await bridge.setSupportedChain("ETH");

      // The only way to mint bridge tokens is to use `mintWithPermit` method but it requires 
      // a signature
      domainSeparator = getDomainSeparatorERC20((await tokenERC20.name()), '1', chainId, bridge.address);
      typeHash = getPermitTypeHashERC20(clientAcc1.address, amount, 0)
      permitDigest = getPermitDigestERC20(domainSeparator, typeHash);
      signature = getSignatureFromDigestERC20(permitDigest, botMessenger);

      await bridge.connect(clientAcc1).mintWithPermitERC20(
      	tokenERC20.address,
      	amount,
      	0,
      	signature.v,
      	signature.r,
      	signature.s
      	);

      await expect(bridge.connect(clientAcc1).burnERC20(tokenERC20.address, amount, clientAcc1.address, "ETH", {value: fee}))
      .to.emit(bridge, "BurnERC20")
        .withArgs(anyValue, anyValue, anyValue, amount, "ETH");

    });

  	it('Should fail to burn ERC20 tokens if user does not have enough tokens', async() => {

  		let amount = ethers.utils.parseUnits("10", 12);
  		let fee = await bridge.calcFee(amount);

  		await bridge.setSupportedChain("ETH");

      await expect(bridge.connect(clientAcc1).burnERC20(tokenERC20.address, amount, clientAcc1.address, "ETH", {value: fee}))
      .to.be.revertedWith("ERC20: burn amount exceeds balance");

    });

    it('Should fail to burn ERC20 tokens if not enought native tokens were sent', async() => {

      let amount = ethers.utils.parseUnits("10", 12);
      let fee = await bridge.calcFee(amount);

      await bridge.setSupportedChain("ETH");

      // The only way to mint bridge tokens is to use `mintWithPermit` method but it requires 
      // a signature
      domainSeparator = getDomainSeparatorERC20((await tokenERC20.name()), '1', chainId, bridge.address);
      typeHash = getPermitTypeHashERC20(clientAcc1.address, amount, 0)
      permitDigest = getPermitDigestERC20(domainSeparator, typeHash);
      signature = getSignatureFromDigestERC20(permitDigest, botMessenger);

      await bridge.connect(clientAcc1).mintWithPermitERC20(
        tokenERC20.address,
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
        );

      await expect(bridge.connect(clientAcc1).burnERC20(tokenERC20.address, amount, clientAcc1.address, "ETH", {value: fee / 2}))
      .to.be.revertedWith("Bridge: not enough native tokens were sent to cover the fees!");

    });

  });



  describe("ERC721 tokens", () => {

    it('Should mint ERC721 tokens to users', async() => {

      let tokenId = 777;

      // The only way to mint bridge tokens is to use `mintWithPermitERC721` method but it requires 
      // a signature
      let domainSeparator = getDomainSeparatorERC721((await tokenERC721.name()), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC721(clientAcc1.address, tokenId, 0)
      let permitDigest = getPermitDigestERC721(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC721(permitDigest, botMessenger);

      expect(await tokenERC721.balanceOf(clientAcc1.address)).to.equal(0);
      await expect(bridge.connect(clientAcc1).mintWithPermitERC721(
        tokenERC721.address,
        tokenId,
        0,
        signature.v,
        signature.r,
        signature.s
        )).to.emit(bridge, "MintWithPermitERC721").withArgs(anyValue, anyValue, anyValue);
      expect(await tokenERC721.balanceOf(clientAcc1.address)).to.equal(1);

    });

    it('Should fail to mint ERC721 tokens with the same nonce', async() => {

      let tokenId = 777;

      let domainSeparator = getDomainSeparatorERC721((await tokenERC721.name()), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC721(clientAcc1.address, tokenId, 0)
      let permitDigest = getPermitDigestERC721(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC721(permitDigest, botMessenger);
      
      await bridge.connect(clientAcc1).mintWithPermitERC721(
        tokenERC721.address,
        tokenId,
        0,
        signature.v,
        signature.r,
        signature.s
        );

      // Try to mint with the same nonce
      await expect(bridge.connect(clientAcc1).mintWithPermitERC721(
        tokenERC721.address,
        tokenId,
        0, // Same nonce
        signature.v,
        signature.r,
        signature.s
        )).to.be.revertedWith("Bridge: request already processed!");

    });


    it('Should fail to mint ERC721 tokens with invalid signature', async() => {

      let tokenId = 777;

      let domainSeparator = getDomainSeparatorERC721((await tokenERC721.name()), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC721(clientAcc1.address, tokenId, 0)
      let permitDigest = getPermitDigestERC721(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC721(permitDigest, botMessenger);
      

      // Try to mint with the same nonce
      await expect(bridge.connect(clientAcc1).mintWithPermitERC721(
        tokenERC721.address,
        tokenId,
        1,
        signature.v,
        signature.r,
        signature.s
        )).to.be.revertedWith("Bridge: invalid signature!");

    });

    it('Should lock and unlock ERC721 tokens', async() => {

      let amount = 1;
      let tokenId = 777;
      let fee = await bridge.calcFee(amount);

      await bridge.setSupportedChain("Ala");

      // Let bridge transfer tokens from client to bridge
      await tokenERC721.connect(clientAcc1).setApprovalForAll(bridge.address, true);

      let domainSeparator = getDomainSeparatorERC721((await tokenERC721.name()), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC721(clientAcc1.address, tokenId, 0)
      let permitDigest = getPermitDigestERC721(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC721(permitDigest, botMessenger);
      
      await bridge.connect(clientAcc1).mintWithPermitERC721(
        tokenERC721.address,
        tokenId,
        0,
        signature.v,
        signature.r,
        signature.s
        );

      // Lock tokens. 
      // Call from the same address as in the signature!
      await expect(await bridge.connect(clientAcc1).lockERC721(tokenERC721.address, tokenId, clientAcc1.address, "Ala", {value: fee}))
      .to.emit(bridge, "LockERC721")
      .withArgs(anyValue, anyValue, anyValue, clientAcc1.address, "Ala");

      // Unlock locked tokens
      domainSeparator = getDomainSeparatorERC721((await tokenERC721.name()), '1', chainId, bridge.address);
      typeHash = getPermitTypeHashERC721(clientAcc1.address, tokenId, 1)
      permitDigest = getPermitDigestERC721(domainSeparator, typeHash);
      signature = getSignatureFromDigestERC721(permitDigest, botMessenger);
       
      await expect(bridge.connect(clientAcc1).unlockWithPermitERC721(
        tokenERC721.address,
        tokenId,
        1,
        signature.v,
        signature.r,
        signature.s
        )).to.emit(bridge, "UnlockWithPermitERC721").withArgs(anyValue, anyValue, anyValue);
    });

    it('Should fail to lock ERC721 tokens if sender does not have token with correct token ID', async() => {

      let amount = 1;
      let fee = await bridge.calcFee(amount);
      let tokenId = 777;

      await bridge.setSupportedChain("Ala");

      await tokenERC721.connect(clientAcc1).setApprovalForAll(bridge.address, true);

      // We did not provide the caller (client) with any ERC721 tokens so far. Token with tokenId does not exist.
      await expect(bridge.connect(clientAcc1).lockERC721(tokenERC721.address, tokenId, clientAcc1.address, "Ala", {value: fee}))
      .to.be.revertedWith("ERC721: invalid token ID");
    });

    it('Should fail to lock ERC721 tokens if not enough native tokens were sent', async() => {


      let amount = 1;
      let tokenId = 777;
      let fee = await bridge.calcFee(amount);

      await bridge.setSupportedChain("Ala");

      // Let bridge transfer tokens from client to bridge
      await tokenERC721.connect(clientAcc1).setApprovalForAll(bridge.address, true);

      let domainSeparator = getDomainSeparatorERC721((await tokenERC721.name()), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC721(clientAcc1.address, tokenId, 0)
      let permitDigest = getPermitDigestERC721(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC721(permitDigest, botMessenger);
      
      await bridge.connect(clientAcc1).mintWithPermitERC721(
        tokenERC721.address,
        tokenId,
        0,
        signature.v,
        signature.r,
        signature.s
        );

      // Lock tokens. 
      // Call from the same address as in the signature!
      await expect(await bridge.connect(clientAcc1).lockERC721(tokenERC721.address, tokenId, clientAcc1.address, "Ala", {value: fee / 2}))
      .to.be.revertedWith("Bridge: not enough native tokens were sent to cover the fees!");

    });

    it('Should fail to unlock ERC721 tokens if bridge does not have token with correct token ID', async() => {

      let amount = 1;
      let tokenId = 777;
      let fee = await bridge.calcFee(amount);

      await tokenERC721.connect(clientAcc1).setApprovalForAll(bridge.address, true);


      domainSeparator = getDomainSeparatorERC721((await tokenERC721.name()), '1', chainId, bridge.address);
      typeHash = getPermitTypeHashERC721(clientAcc1.address, 888, 1)
      permitDigest = getPermitDigestERC721(domainSeparator, typeHash);
      signature = getSignatureFromDigestERC721(permitDigest, botMessenger);

      // Try to unlock tokens
      await expect(bridge.connect(clientAcc1).unlockWithPermitERC721(
        tokenERC721.address,
        888,
        1,
        signature.v,
        signature.r,
        signature.s
        )).to.be.revertedWith("Bridge: not enough ERC721 tokens on the bridge balance!");
    });

    it('Should burn ERC721 tokens', async() => {

      let amount = 1;
      let tokenId = 777;
      let fee = await bridge.calcFee(amount);

      await bridge.setSupportedChain("ETH");


      let domainSeparator = getDomainSeparatorERC721((await tokenERC721.name()), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC721(clientAcc1.address, tokenId, 0)
      let permitDigest = getPermitDigestERC721(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC721(permitDigest, botMessenger);

      await bridge.connect(clientAcc1).mintWithPermitERC721(
        tokenERC721.address,
        tokenId,
        0,
        signature.v,
        signature.r,
        signature.s
        );


      await expect(bridge.connect(clientAcc1).burnERC721(tokenERC721.address, tokenId, clientAcc1.address, "ETH", {value: fee}))
      .to.emit(bridge, "BurnERC721")
      .withArgs(anyValue, anyValue, anyValue, clientAcc1.address, "ETH");

    });

    it('Should fail to burn ERC721 tokens if user does not have a token with correct ID', async() => {

      let amount = ethers.utils.parseUnits("10", 12);
      let fee = await bridge.calcFee(amount);

      await bridge.setSupportedChain("ETH");

      await expect(bridge.connect(clientAcc1).burnERC721(tokenERC721.address, amount, clientAcc1.address, "ETH", {value: fee}))
      .to.be.revertedWith("ERC721: invalid token ID");

    });

    it('Should fail to burn ERC721 tokens if not enough native tokens were sent', async() => {

      let amount = 1;
      let tokenId = 777;
      let fee = await bridge.calcFee(amount);

      await bridge.setSupportedChain("ETH");


      let domainSeparator = getDomainSeparatorERC721((await tokenERC721.name()), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC721(clientAcc1.address, tokenId, 0)
      let permitDigest = getPermitDigestERC721(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC721(permitDigest, botMessenger);

      await bridge.connect(clientAcc1).mintWithPermitERC721(
        tokenERC721.address,
        tokenId,
        0,
        signature.v,
        signature.r,
        signature.s
        );

      await expect(bridge.connect(clientAcc1).burnERC721(tokenERC721.address, tokenId, clientAcc1.address, "ETH", {value: fee / 2}))
      .to.be.revertedWith("Bridge: not enough native tokens were sent to cover the fees!");

    });

  });
  


  describe("ERC1155 tokens", () => {

    it('Should mint ERC1155 tokens to users', async() => {

      // ID of type of tokens
      let tokenId = 444;
      // The amount tokens of that type
      let amount = 10;

      // The only way to mint bridge tokens is to use `mintWithPermitERC1155` method but it requires 
      // a signature
      let domainSeparator = getDomainSeparatorERC1155((await tokenERC1155.uri(tokenId)), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC1155(clientAcc1.address, tokenId, amount, 0)
      let permitDigest = getPermitDigestERC1155(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC1155(permitDigest, botMessenger);

      expect(await tokenERC1155.balanceOf(clientAcc1.address, tokenId)).to.equal(0);
      await expect(bridge.connect(clientAcc1).mintWithPermitERC1155(
        tokenERC1155.address,
        tokenId,
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
        )).to.emit(bridge, "MintWithPermitERC1155").withArgs(anyValue, anyValue, anyValue, amount);
      //expect(await tokenERC1155.balanceOf(clientAcc1.address, tokenId)).to.equal(amount);

    });

    it('Should fail to mint ERC1155 tokens with the same nonce', async() => {

      let tokenId = 444;
      let amount = 10;

      let domainSeparator = getDomainSeparatorERC1155((await tokenERC1155.uri(tokenId)), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC1155(clientAcc1.address, tokenId, amount, 0)
      let permitDigest = getPermitDigestERC1155(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC1155(permitDigest, botMessenger);
      
      await bridge.connect(clientAcc1).mintWithPermitERC1155(
        tokenERC1155.address,
        tokenId,
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
        );

      // Try to mint with the same nonce
      await expect(bridge.connect(clientAcc1).mintWithPermitERC1155(
        tokenERC1155.address,
        tokenId,
        amount,
        0, // Same nonce
        signature.v,
        signature.r,
        signature.s
        )).to.be.revertedWith("Bridge: request already processed!");

    });

    it('Should fail to mint ERC1155 tokens with invalid signature', async() => {

      let tokenId = 444;
      let amount = 10;

      let domainSeparator = getDomainSeparatorERC1155((await tokenERC1155.uri(tokenId)), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC1155(clientAcc1.address, tokenId, amount, 0)
      let permitDigest = getPermitDigestERC1155(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC1155(permitDigest, botMessenger);
      
      await expect(bridge.connect(clientAcc1).mintWithPermitERC1155(
        tokenERC1155.address,
        tokenId,
        amount,
        1, 
        signature.v,
        signature.r,
        signature.s
        )).to.be.revertedWith("Bridge: invalid signature!");

    });

    it('Should lock and unlock ERC1155 tokens', async() => {

      let tokenId = 444;
      let amount = 10;
      let fee = await bridge.calcFee(amount);

      await bridge.setSupportedChain("Ala");

      // Let bridge transfer tokens from client to bridge
      await tokenERC1155.connect(clientAcc1).setApprovalForAll(bridge.address, true);

      let domainSeparator = getDomainSeparatorERC1155((await tokenERC1155.uri(tokenId)), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC1155(clientAcc1.address, tokenId, amount, 0)
      let permitDigest = getPermitDigestERC1155(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC1155(permitDigest, botMessenger);
      
      await bridge.connect(clientAcc1).mintWithPermitERC1155(
        tokenERC1155.address,
        tokenId,
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
        );

      // Lock tokens. 
      // Call from the same address as in the signature!
      await expect(await bridge.connect(clientAcc1).lockERC1155(tokenERC1155.address, tokenId, amount, clientAcc1.address, "Ala", {value: fee}))
      .to.emit(bridge, "LockERC1155")
      .withArgs(anyValue, anyValue, anyValue, clientAcc1.address, amount, "Ala");

      // Unlock locked tokens
      domainSeparator = getDomainSeparatorERC1155((await tokenERC1155.uri(tokenId)), '1', chainId, bridge.address);
      typeHash = getPermitTypeHashERC1155(clientAcc1.address, tokenId, amount, 1)
      permitDigest = getPermitDigestERC1155(domainSeparator, typeHash);
      signature = getSignatureFromDigestERC1155(permitDigest, botMessenger);
       
      await expect(bridge.connect(clientAcc1).unlockWithPermitERC1155(
        tokenERC1155.address,
        tokenId,
        amount,
        1,
        signature.v,
        signature.r,
        signature.s
        )).to.emit(bridge, "UnlockWithPermitERC1155").withArgs(anyValue, anyValue, anyValue, amount);
    });

    it('Should fail to lock ERC1155 tokens if sender does not have enough tokens of a given type', async() => {

      let tokenId = 444;
      let amount = 10;
      let fee = await bridge.calcFee(amount);

      await bridge.setSupportedChain("Ala");

      await tokenERC1155.connect(clientAcc1).setApprovalForAll(bridge.address, true);

      // We did not provide the caller (client) with any ERC1155 tokens so far. Token with tokenId does not exist.
      await expect(bridge.connect(clientAcc1).lockERC1155(tokenERC1155.address, tokenId, amount, clientAcc1.address, "Ala", {value: fee}))
      .to.be.revertedWith("ERC1155: insufficient balance for transfer");
    });

    it('Should fail to lock ERC1155 tokens if not enough native tokens were sent', async() => {

      let tokenId = 444;
      let amount = 10;
      let fee = await bridge.calcFee(amount);

      await bridge.setSupportedChain("Ala");

      // Let bridge transfer tokens from client to bridge
      await tokenERC1155.connect(clientAcc1).setApprovalForAll(bridge.address, true);

      let domainSeparator = getDomainSeparatorERC1155((await tokenERC1155.uri(tokenId)), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC1155(clientAcc1.address, tokenId, amount, 0)
      let permitDigest = getPermitDigestERC1155(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC1155(permitDigest, botMessenger);
      
      await bridge.connect(clientAcc1).mintWithPermitERC1155(
        tokenERC1155.address,
        tokenId,
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
        );

      // Lock tokens. 
      // Call from the same address as in the signature!
      await expect(await bridge.connect(clientAcc1).lockERC1155(tokenERC1155.address, tokenId, amount, clientAcc1.address, "Ala", {value: fee / 2}))
      .to.be.revertedWith("Bridge: not enough native tokens were sent to cover the fees!");

    });

    it('Should fail to unlock ERC1155 tokens if bridge does not have enough tokens of a given type', async() => {

      let tokenId = 444;
      let amount = 10;
      let fee = await bridge.calcFee(amount);

      let domainSeparator = getDomainSeparatorERC1155((await tokenERC1155.uri(tokenId)), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC1155(clientAcc1.address, tokenId, amount, 0)
      let permitDigest = getPermitDigestERC1155(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC1155(permitDigest, botMessenger);
      
      await bridge.connect(clientAcc1).mintWithPermitERC1155(
        tokenERC1155.address,
        tokenId,
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
        );

      domainSeparator = getDomainSeparatorERC1155((await tokenERC1155.uri(tokenId)), '1', chainId, bridge.address);
      typeHash = getPermitTypeHashERC1155(clientAcc2.address, tokenId, amount, 1)
      permitDigest = getPermitDigestERC1155(domainSeparator, typeHash);
      signature = getSignatureFromDigestERC1155(permitDigest, botMessenger);

      await expect(bridge.connect(clientAcc2).unlockWithPermitERC1155(
        tokenERC1155.address,
        tokenId,
        amount,
        1,
        signature.v,
        signature.r,
        signature.s
        )).to.be.revertedWith("Bridge: not enough ERC1155 tokens on the bridge balance!");
    });

    it('Should burn ERC1155 tokens', async() => {

      let tokenId = 444;
      let amount = 10;
      let fee = await bridge.calcFee(amount);

      await bridge.setSupportedChain("ETH");

      let domainSeparator = getDomainSeparatorERC1155((await tokenERC1155.uri(tokenId)), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC1155(clientAcc1.address, tokenId, amount, 0)
      let permitDigest = getPermitDigestERC1155(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC1155(permitDigest, botMessenger);

      await bridge.connect(clientAcc1).mintWithPermitERC1155(
        tokenERC1155.address,
        tokenId,
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
        );

      await expect(bridge.connect(clientAcc1).burnERC1155(tokenERC1155.address, tokenId, amount, clientAcc1.address, "ETH", {value: fee}))
      .to.emit(bridge, "BurnERC1155")
      .withArgs(anyValue, anyValue, anyValue, clientAcc1.address, amount, "ETH");

    });

    it('Should fail to burn ERC1155 tokens if user does not have enough tokens of a given type', async() => {

      let amount = 1;
      let tokenId = 777;
      let fee = await bridge.calcFee(amount);

      await bridge.setSupportedChain("ETH");

      await expect(bridge.connect(clientAcc1).burnERC1155(tokenERC1155.address, tokenId, amount, clientAcc1.address, "ETH", {value: fee}))
      .to.be.revertedWith("ERC1155: burn amount exceeds balance");

    });

    it('Should fail to burn ERC1155 tokens if not enough native tokens were sent', async() => {

      let tokenId = 444;
      let amount = 10;
      let fee = await bridge.calcFee(amount);

      await bridge.setSupportedChain("ETH");

      let domainSeparator = getDomainSeparatorERC1155((await tokenERC1155.uri(tokenId)), '1', chainId, bridge.address);
      let typeHash = getPermitTypeHashERC1155(clientAcc1.address, tokenId, amount, 0)
      let permitDigest = getPermitDigestERC1155(domainSeparator, typeHash);
      let signature = getSignatureFromDigestERC1155(permitDigest, botMessenger);

      await bridge.connect(clientAcc1).mintWithPermitERC1155(
        tokenERC1155.address,
        tokenId,
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
        );

      await expect(bridge.connect(clientAcc1).burnERC1155(tokenERC1155.address, tokenId, amount, clientAcc1.address, "ETH", {value: fee / 2}))
      .to.be.revertedWith("Bridge: not enough native tokens were sent to cover the fees!");

    });
  });


	describe("Helper Functions", async () => {

		it('Should set new admin', async() => {
      // Client does not have admin rights here
      await expect(bridge.connect(clientAcc1).setSupportedChain("Ala"))
      .to.be.revertedWith("Bridge: the caller is not an admin!");
      await expect(bridge.setAdmin(clientAcc1.address))
      .to.emit(bridge, "SetAdmin").withArgs(anyValue);
      // Now he does
      await bridge.connect(clientAcc1).setSupportedChain("Ala");
	  });

    it('Should fail to set new admin with invalid address', async() => {
      await expect(bridge.setAdmin(addressZero))
        .to.be.revertedWith("Bridge: new admin can not have a zero address!");
    });

    it('Should set new fee rate', async() => {
      // Try to set fee rate more than 100% (10_000 BP)
      await expect(bridge.setFeeRate(1000))
        .to.emit(bridge, "SetFeeRate").withArgs(anyValue);
    });

		it('Should fail to set very high new fee rate', async() => {
      // Try to set fee rate more than 100% (10_000 BP)
      await expect(bridge.setFeeRate(10_100))
      .to.be.revertedWith("Bridge: fee rate is too high!");
	  });

		it('Should calculate fee amount correctly', async() => {
			let precentDenominator = 10_000;
			let feeRateBp = 30;
			let amount = ethers.utils.parseUnits("10", 18);
			let expectedFee = amount.mul(feeRateBp).div(precentDenominator);
			expect(await bridge.calcFee(amount)).to.equal(expectedFee);
      // Now try to use a very low amount. Should fail.
      amount = 1;
      await expect(bridge.calcFee(amount))
      // TODO It does not revert because the line responsible for this was temporary commented out 
      .to.be.revertedWith("Bridge: transaction amount too low for fees!");
	  });

		it('Should collect fees from tokens transactions', async() => {

      // First we lock some native tokens
      // Transaction of 10 ether should collect 0.03 ether in fees
      let amount = ethers.utils.parseEther("10");
      let fee = await bridge.calcFee(amount);
      let sum = amount.add(fee);

      await bridge.setSupportedChain("Ala");

      await expect(bridge.lockNative(amount, clientAcc1.address, "Ala", {value: sum}))
      .to.emit(bridge, "LockNative")
      .withArgs(anyValue, anyValue, amount, "Ala");

      // Then try to collect fees
      let feeToWithDraw = ethers.utils.parseEther("0.03");

    	let startBalance = await provider.getBalance(bridge.address);
      await expect(bridge.withdraw(addressZero, feeToWithDraw))
      .to.emit(bridge, "Withdraw")
      .withArgs(anyValue, feeToWithDraw);
      let endBalance = await provider.getBalance(bridge.address);
    	expect(startBalance.sub(endBalance)).to.equal(feeToWithDraw);
	  });

		it('Should fail to collect fees from tokens with no transactions ', async() => {

      // Collect fees right away
      let feeToWithDraw = ethers.utils.parseEther("0.03");

      await expect(bridge.withdraw(addressZero, feeToWithDraw))
      .to.be.revertedWith("Bridge: no fees were collected for this token!");

	  });

		it('Should fail to collect too high fees ', async() => {

      // First we lock some native tokens
      // Transaction of 10 ether should collect 0.03 ether in fees
      let amount = ethers.utils.parseEther("10");
      let fee = await bridge.calcFee(amount);
      let sum = amount.add(fee);

      await bridge.setSupportedChain("Ala");

      await expect(bridge.lockNative(amount, clientAcc1.address, "Ala", {value: sum}))
      .to.emit(bridge, "LockNative")
      .withArgs(anyValue, anyValue, amount, "Ala");

      // Set an enormous amount of fees
      let feeToWithDraw = ethers.utils.parseEther("1000");

      await expect(bridge.withdraw(addressZero, feeToWithDraw))
      .to.be.revertedWith("Bridge: amount of fees to withdraw is too large!");
	  });

		it('Should add and remove supported chains', async() => {

			let amount = ethers.utils.parseEther('1');
			let fee = await bridge.calcFee(amount);
      let sum = amount.add(fee);

      // Forbid transactions on Ala chain
      await expect(bridge.removeSupportedChain("Ala"))
      .to.emit(bridge, "RemoveChain").withArgs(anyValue);

      await expect(bridge.lockNative(amount, clientAcc1.address, "Ala", {value: sum}))
      .to.be.revertedWith("Bridge: the chain is not supported!");

      // Allow transactions on Ala chain
      await expect(bridge.setSupportedChain("Ala"))
      .to.emit(bridge, "SetNewChain").withArgs(anyValue);

      await expect(bridge.lockNative(amount, clientAcc1.address, "Ala", {value: sum}))
      .to.emit(bridge, "LockNative")
      .withArgs(anyValue, anyValue, amount, "Ala");

	  });
	});
});


describe("Bridge extras", async () => {

  const addressZero = "0x0000000000000000000000000000000000000000";

    [ownerAcc, clientAcc1, clientAcc2] = await ethers.getSigners();

    let bridgeTx = await ethers.getContractFactory("Bridge");
    await expect(bridgeTx.deploy(addressZero))
    .to.be.revertedWith("Bridge: default bot messenger can not be zero address!");

    await bridge.deployed();

});