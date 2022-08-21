// SPDX-License-Identifier: MIT

const { ethers } = require("hardhat");
const { expect } = require("chai");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const { getDomainSeparator, getPermitDigest, getSignatureFromDigest } = require("./utils/sign");
const {boolean} = require("hardhat/internal/core/params/argumentTypes");

describe('Bridge', () => {

	// Constants to be used afterwards
	let token;
	let factory;
	let bridge;
	const addressZero = "0x0000000000000000000000000000000000000000";

  // Default Chain ID for Hardhat local network
	const chainId = 31337;

  // Imitate the BOT_MESSENGER role using a wallet generated from mnemonic
	let mnemonic = "announce room limb pattern dry unit scale effort smooth jazz weasel alcohol";
	let bot_messenger = ethers.Wallet.fromMnemonic(mnemonic);

  // Deploy all contracts before each test suite
  beforeEach( async () => {
  	[ownerAcc, clientAcc1, clientAcc2] = await ethers.getSigners();
    
  	let tokenTx = await ethers.getContractFactory("WrappedERC20");
  	let factoryTx = await ethers.getContractFactory("WrappedERC20Factory");
  	let bridgeTx = await ethers.getContractFactory("Bridge");

    // Owner is a bot messenger. Fee rate is 1%
    bridge = await bridgeTx.deploy(bot_messenger.address, 100);
    token = await tokenTx.deploy();
    factory = await factoryTx.deploy();

    await token.deployed();
    await token.initialize("Integral", "SFXDX", 18, bridge.address);
    await factory.deployed();
    await bridge.deployed();

  });

  describe("Native Tokens", () => {

  	it('Should lock and unlock native tokens', async() => {

  		let amount = ethers.utils.parseEther('1');
  		let fee = await bridge.calcFee(amount);
  		let sum = amount.add(fee);

      await bridge.setSupportedChain("Ala");

      // Transfer ether to the bridge and lock it there
      await expect(bridge.lock(addressZero, amount, clientAcc1.address, "Ala", {value: sum}))
        .to.emit(bridge, "Lock")
        // First three parameters are indexed (hashed) in the event, so their value is uknown 
        .withArgs(anyValue, anyValue, anyValue, amount, "Ala");

      // Unlock locked tokens
      // NOTE We have to provide token name "Native" for **any** native token
      let domain_separator = getDomainSeparator("Native", '1', chainId, bridge.address);
      let permitDigest = getPermitDigest(domain_separator, clientAcc1.address, amount, 0);
      let signature = getSignatureFromDigest(permitDigest, bot_messenger);
      // Call unlock method providing parts of the signature
      await expect(bridge.connect(clientAcc1).unlockWithPermit(
        addressZero,
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
      )).to.emit(bridge, "UnlockWithPermit").withArgs(anyValue, anyValue, amount);
    });

    it('Should fail to lock native tokens if not enough tokens were sent', async() => {

      let amount = ethers.utils.parseEther('1');
      let fee = await bridge.calcFee(amount);
      let sum = amount.add(fee);

      await bridge.setSupportedChain("Ala");

      // Set `value` to less than `sum`
      await expect(bridge.lock(addressZero, amount, clientAcc1.address, "Ala", {value: sum.div(2)}))
        .to.be.revertedWith("Bridge: not enough tokens to cover the fee!");
    });

    it('Should fail to unlock native tokens if not enough tokens on the bridge', async() => {

      let amount = ethers.utils.parseEther('1');
      let fee = await bridge.calcFee(amount);
      let sum = amount.add(fee);

      // We did not provide the bridge with any native tokens so far. So it can not send them back
      let domain_separator = getDomainSeparator("Native", '1', chainId, bridge.address);
      let permitDigest = getPermitDigest(domain_separator, clientAcc1.address, amount, 0);
      let signature = getSignatureFromDigest(permitDigest, bot_messenger);
      await expect(bridge.connect(clientAcc1).unlockWithPermit(
        addressZero,
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
      )).to.be.revertedWith("Bridge: not enough native tokens on the bridge balance!");
    });
  });


  describe("ERC20 Tokens", () => {
    it('Should mint ERC20 tokens to users', async() => {

      let amount = 10;

      // The only way to mint bridge tokens is to use `mintWithPermit` method but it requires 
      // a signature
      let domain_separator = getDomainSeparator((await token.name()), '1', chainId, bridge.address);
      let permitDigest = getPermitDigest(domain_separator, clientAcc1.address, amount, 0);
      // Get the signature
      let signature = getSignatureFromDigest(permitDigest, bot_messenger);
      // Call mint method providing parts of the signature
      await expect(bridge.connect(clientAcc1).mintWithPermit(
        token.address,
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
      )).to.emit(bridge, "MintWithPermit").withArgs(token.address, clientAcc1.address, amount);

    });

    it('Should fail to mint ERC20 tokens with the same nonce', async() => {

      let amount = 10;

      // The only way to mint bridge tokens is to use `mintWithPermit` method but it requires 
      // a signature
      let domain_separator = getDomainSeparator((await token.name()), '1', chainId, bridge.address);
      // Get digest with one nonce
      let permitDigest = getPermitDigest(domain_separator, clientAcc1.address, amount, 0);
      // Get the signature
      let signature = getSignatureFromDigest(permitDigest, bot_messenger);
      // Call mint method providing parts of the signature
      await bridge.connect(clientAcc1).mintWithPermit(
        token.address,
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
      );
      // Try to mint with the same nonce
      await expect(bridge.connect(clientAcc1).mintWithPermit(
        token.address,
        amount,
        0, // Same nonce
        signature.v,
        signature.r,
        signature.s
      )).to.be.revertedWith("Bridge: request already processed!");

    });

    it('Should lock and unlock ERC20 tokens', async() => {

      let amount = 10;
      let fee = await bridge.calcFee(amount);
      let sum = amount + fee;

      await bridge.setSupportedChain("Ala");

      // Let bridge transfer tokens from client to bridge
      await token.connect(clientAcc1).increaseAllowance(bridge.address, sum);

      // The only way to mint bridge tokens is to use `mintWithPermit` method but it requires 
      // a signature
      let domain_separator = getDomainSeparator((await token.name()), '1', chainId, bridge.address);
      let permitDigest = getPermitDigest(domain_separator, clientAcc1.address, sum, 0);
      // Get the signature
      let signature = getSignatureFromDigest(permitDigest, bot_messenger);
      // Call mint method providing parts of the signature
      await bridge.connect(clientAcc1).mintWithPermit(
        token.address,
        sum,
        0,
        signature.v,
        signature.r,
        signature.s
      );

      // Lock tokens. 
      // Call from the same address as in the signature!
      await expect(await bridge.connect(clientAcc1).lock(token.address, amount, clientAcc1.address, "Ala"))
        .to.emit(bridge, "Lock")
        // First three parameters are indexed (hashed) in the event, so their value is uknown 
        .withArgs(anyValue, anyValue, anyValue, amount, "Ala");

      // Unlock locked tokens
      // NOTE When unlocking custom ERC20 tokens we have to provide token's name explicitly
      domain_separator = getDomainSeparator((await token.name()), '1', chainId, bridge.address);
      permitDigest = getPermitDigest(domain_separator, clientAcc1.address, amount, 1);
      signature = getSignatureFromDigest(permitDigest, bot_messenger);
      // Call unlock method providing parts of the signature
      await expect(bridge.connect(clientAcc1).unlockWithPermit(
        token.address,
        amount,
        1,
        signature.v,
        signature.r,
        signature.s
      )).to.emit(bridge, "UnlockWithPermit").withArgs(anyValue, anyValue, amount);
    });

    it('Should fail to lock ERC20 tokens if sender does not have enough tokens', async() => {

      let amount = ethers.utils.parseEther('1');
      let fee = await bridge.calcFee(amount);
      let sum = amount.add(fee);

      await bridge.setSupportedChain("Ala");
      // Let bridge transfer tokens from client to bridge
      await token.connect(clientAcc1).increaseAllowance(bridge.address, sum);

      // We did not provide the caller (client) with any ERC tokens so far. So the bridge can not 
      // tranfer them from user's adrress fo the bridge itself
      await expect(bridge.connect(clientAcc1).lock(token.address, amount, clientAcc1.address, "Ala"))
        .to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it('Should fail to unlock ERC20 tokens if not enough tokens on the bridge', async() => {

      let amount = ethers.utils.parseEther('1');
      let fee = await bridge.calcFee(amount);
      let sum = amount.add(fee);

      // We did not provide the bridge with any native tokens so far. So it can not send them back
      let domain_separator = getDomainSeparator((await token.name()), '1', chainId, bridge.address);
      let permitDigest = getPermitDigest(domain_separator, clientAcc1.address, amount, 0);
      let signature = getSignatureFromDigest(permitDigest, bot_messenger);
      await expect(bridge.connect(clientAcc1).unlockWithPermit(
        token.address,
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
      )).to.be.revertedWith("Bridge: not enough ERC20 tokens on the bridge balance!");
    });

    it('Should burn ERC20 tokens', async() => {

      let amount = 10;
      let fee = await bridge.calcFee(amount);
      let sum = amount + fee;

      await bridge.setSupportedChain("ETH");

      // Let bridge transfer tokens from client to bridge
      await token.connect(clientAcc1).increaseAllowance(bridge.address, sum);

      // The only way to mint bridge tokens is to use `mintWithPermit` method but it requires 
      // a signature
      let domain_separator = getDomainSeparator((await token.name()), '1', chainId, bridge.address);
      let permitDigest = getPermitDigest(domain_separator, clientAcc1.address, sum, 0);
      // Get the signature
      let signature = getSignatureFromDigest(permitDigest, bot_messenger);
      // Call mint method providing parts of the signature
      await bridge.connect(clientAcc1).mintWithPermit(
        token.address,
        sum,
        0,
        signature.v,
        signature.r,
        signature.s
      );
      await expect(bridge.connect(clientAcc1).burn(token.address, amount, clientAcc1.address, "ETH"))
        .to.emit(bridge, "Burn")
        // First three parameters are indexed (hashed) in the event, so their value is uknown 
        .withArgs(anyValue, anyValue, anyValue, amount, "ETH");

    });

    it('Should fail to burn ERC20 tokens not enough tokens on the bridge', async() => {

      let amount = 10;
      let fee = await bridge.calcFee(amount);
      let sum = amount + fee;

      await bridge.setSupportedChain("ETH");
      // Let bridge transfer tokens from client to bridge
      await token.connect(clientAcc1).increaseAllowance(bridge.address, sum);

      await expect(bridge.connect(clientAcc1).burn(token.address, amount, clientAcc1.address, "ETH"))
        .to.be.revertedWith("ERC20: transfer amount exceeds balance");

    });
  });


  describe("Full Flow", () => {

   it('Should lock native tokens and mint ERC20 tokens', async() => {

      let amount = ethers.utils.parseEther('1');
      let fee = await bridge.calcFee(amount);
      let sum = amount.add(fee);

      await bridge.setSupportedChain("Ala");

      // Transfer ether to the bridge and lock it there
      // Use clientAcc1 here
      await expect(bridge.lock(addressZero, amount, clientAcc1.address, "Ala", {value: sum}))
        .to.emit(bridge, "Lock")
        .withArgs(anyValue, anyValue, anyValue, amount, "Ala");

      // Mint ERC20 tokens
      // NOTE This should happen on the other chain for another client's account
      // Use clientAcc2 here
      let domain_separator = getDomainSeparator((await token.name()), '1', chainId, bridge.address);
      let permitDigest = getPermitDigest(domain_separator, clientAcc2.address, amount, 0);
      // Get the signature
      let signature = getSignatureFromDigest(permitDigest, bot_messenger);
      // Call mint method providing parts of the signature
      await expect(bridge.connect(clientAcc2).mintWithPermit(
        token.address,
        amount,
        0,
        signature.v,
        signature.r,
        signature.s
      )).to.emit(bridge, "MintWithPermit").withArgs(token.address, clientAcc2.address, amount);
      
    });

    it('Should lock ERC20 tokens and mint ERC20 tokens', async() => {

      let amount = ethers.utils.parseEther('1');
      let fee = await bridge.calcFee(amount);
      let sum = amount.add(fee);

      await bridge.setSupportedChain("Ala");

      // Let bridge transfer tokens from client to bridge
      await token.connect(clientAcc1).increaseAllowance(bridge.address, sum);

      // Send some tokens to the client
      let domain_separator = getDomainSeparator((await token.name()), '1', chainId, bridge.address);
      let permitDigest = getPermitDigest(domain_separator, clientAcc1.address, sum, 0);
      let signature = getSignatureFromDigest(permitDigest, bot_messenger);
      await bridge.connect(clientAcc1).mintWithPermit(
        token.address,
        sum,
        0,
        signature.v,
        signature.r,
        signature.s
      );

      // Lock client's ERC20 tokens
      await expect(await bridge.connect(clientAcc1).lock(token.address, amount, clientAcc1.address, "Ala"))
        .to.emit(bridge, "Lock")
        .withArgs(anyValue, anyValue, anyValue, amount, "Ala");

      // Mint ERC20 tokens
      // NOTE This should happen on the other chain for another client's account
      // Use clientAcc2 here
      domain_separator = getDomainSeparator((await token.name()), '1', chainId, bridge.address);
      permitDigest = getPermitDigest(domain_separator, clientAcc2.address, amount, 1);
      // Get the signature
      signature = getSignatureFromDigest(permitDigest, bot_messenger);
      // Call mint method providing parts of the signature
      await expect(bridge.connect(clientAcc2).mintWithPermit(
        token.address,
        amount,
        1,
        signature.v,
        signature.r,
        signature.s
      )).to.emit(bridge, "MintWithPermit").withArgs(token.address, clientAcc2.address, amount);;
      
    });


    it('Should lock(native), mint(ERC20), burn(ERC20), unlock(native)', async() => {

      let amount = ethers.utils.parseEther('1');
      let fee = await bridge.calcFee(amount);
      let sum = amount.add(fee);

      await bridge.setSupportedChain("Ala");
      await bridge.setSupportedChain("ETH");

      // Lock native tokens
      await expect(bridge.connect(clientAcc1).lock(addressZero, amount, clientAcc1.address, "Ala", {value: sum}))
        .to.emit(bridge, "Lock")
        .withArgs(anyValue, anyValue, anyValue, amount, "Ala");

      // Mint ERC20 tokens
      // NOTE This should happen on the other chain for another client's account
      // Use clientAcc2 here
      let domain_separator = getDomainSeparator((await token.name()), '1', chainId, bridge.address);
      let permitDigest = getPermitDigest(domain_separator, clientAcc2.address, sum, 0);
      // Get the signature
      let signature = getSignatureFromDigest(permitDigest, bot_messenger);
      // Call mint method providing parts of the signature
      await expect(bridge.connect(clientAcc2).mintWithPermit(
        token.address,
        sum, // Usually `amount` should be minted, but to burn tokens, client has to pay fees again
        0,
        signature.v,
        signature.r,
        signature.s
      )).to.emit(bridge, "MintWithPermit").withArgs(token.address, clientAcc2.address, sum);

      
      // Burn minted ERC20 tokens
      // NOTE This should happen on the other chain for another client's account
      // Let bridge transfer tokens from client to bridge
      await token.connect(clientAcc2).increaseAllowance(bridge.address, sum);

      // Caller pays extra fee to burn tokens. That is why `sum` but not `amount` was minted to him previously
      await expect(bridge.connect(clientAcc2).burn(token.address, amount, clientAcc1.address, "ETH"))
        .to.emit(bridge, "Burn")
        // First three parameters are indexed (hashed) in the event, so their value is uknown 
        .withArgs(anyValue, anyValue, anyValue, amount, "ETH");

      // Unlock locked native tokens
      // NOTE We have to provide token name "Native" for **any** native token
      domain_separator = getDomainSeparator("Native", '1', chainId, bridge.address);
      permitDigest = getPermitDigest(domain_separator, clientAcc1.address, amount, 1);
      signature = getSignatureFromDigest(permitDigest, bot_messenger);
      await expect(bridge.connect(clientAcc1).unlockWithPermit(
        addressZero,
        amount,
        1,
        signature.v,
        signature.r,
        signature.s
      )).to.emit(bridge, "UnlockWithPermit").withArgs(anyValue, anyValue, amount);
    });

    it('Should lock(ERC20), mint(ERC20), burn(ERC20), unlock(ERC20)', async() => {

      let amount = 10;
      let fee = await bridge.calcFee(amount);
      let sum = amount + fee;

      await bridge.setSupportedChain("Ala");
      await bridge.setSupportedChain("ETH");

      // First mint some ERC20 tokens to the client
      await token.connect(clientAcc1).increaseAllowance(bridge.address, sum);
      let domain_separator = getDomainSeparator((await token.name()), '1', chainId, bridge.address);
      let permitDigest = getPermitDigest(domain_separator, clientAcc1.address, sum, 0);
      // Get the signature
      let signature = getSignatureFromDigest(permitDigest, bot_messenger);
      // Call mint method providing parts of the signature
      await bridge.connect(clientAcc1).mintWithPermit(
        token.address,
        sum,
        0,
        signature.v,
        signature.r,
        signature.s
      );

      // Lock minted ERC20 tokens
      // Call from the same address as in the signature!
      await expect(await bridge.connect(clientAcc1).lock(token.address, amount, clientAcc1.address, "Ala"))
        .to.emit(bridge, "Lock")
        // First three parameters are indexed (hashed) in the event, so their value is uknown 
        .withArgs(anyValue, anyValue, anyValue, amount, "Ala");


      // Mint ERC20 tokens
      // NOTE This should happen on the other chain for another client's account
      // Use clientAcc2 here
      domain_separator = getDomainSeparator((await token.name()), '1', chainId, bridge.address);
      permitDigest = getPermitDigest(domain_separator, clientAcc2.address, sum, 1);
      // Get the signature
      signature = getSignatureFromDigest(permitDigest, bot_messenger);
      // Call mint method providing parts of the signature
      await expect(bridge.connect(clientAcc2).mintWithPermit(
        token.address,
        sum, // Usually `amount` should be minted, but to burn tokens, client has to pay fees again
        1,
        signature.v,
        signature.r,
        signature.s
      )).to.emit(bridge, "MintWithPermit").withArgs(token.address, clientAcc2.address, sum);

      
      // Burn minted ERC20 tokens
      // NOTE This should happen on the other chain for another client's account
      // Let bridge transfer tokens from client to bridge
      await token.connect(clientAcc2).increaseAllowance(bridge.address, sum);

      // Caller pays extra fee to burn tokens. That is why `sum` but not `amount` was minted to him previously
      await expect(bridge.connect(clientAcc2).burn(token.address, amount, clientAcc1.address, "ETH"))
        .to.emit(bridge, "Burn")
        // First three parameters are indexed (hashed) in the event, so their value is uknown 
        .withArgs(anyValue, anyValue, anyValue, amount, "ETH");

      // Unlock locked tokens
      // NOTE When unlocking custom ERC20 tokens we have to provide token's name explicitly
      domain_separator = getDomainSeparator((await token.name()), '1', chainId, bridge.address);
      permitDigest = getPermitDigest(domain_separator, clientAcc1.address, amount, 2);
      signature = getSignatureFromDigest(permitDigest, bot_messenger);
      await expect(bridge.connect(clientAcc1).unlockWithPermit(
        token.address,
        amount,
        2,
        signature.v,
        signature.r,
        signature.s
      )).to.emit(bridge, "UnlockWithPermit").withArgs(anyValue, anyValue, amount);
    });
  });
});
