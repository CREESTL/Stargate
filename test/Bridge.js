// SPDX-License-Identifier: MIT

const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const { 
  getSignatureFromDigest,
  getPermitDigest, 
  getDomainSeparator, 
  getPermitTypeHash,
  getVerifyPriceTypeHash
} = require("./utils/sign");


const {boolean} = require("hardhat/internal/core/params/argumentTypes");
const parseEther = ethers.utils.parseEther;
const EPSILON = parseEther("0.001");
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
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    client1   = accounts[1];
    client2   = accounts[2];
    client3   = accounts[3];
    unames = [ 'owner', 'client1', 'client2', 'client3' ];

    let token = await ethers.getContractFactory("TestERC20");
  	let tokenERC20Tx = await ethers.getContractFactory("WrappedERC20");
    let tokenERC721Tx = await ethers.getContractFactory("TestERC721");
    let tokenERC1155Tx = await ethers.getContractFactory("TestERC1155");

  	bridgeTx = await ethers.getContractFactory("Bridge");

    // Owner is a bot messenger. 
    stablecoin = await token.deploy("USDT", "USDT");
    stargateToken = await token.deploy("ST", "ST");
    transferToken = await token.deploy("TT", "TT");

    tokenERC20 = await tokenERC20Tx.deploy();
    tokenERC721 = await tokenERC721Tx.deploy();
    tokenERC1155 = await tokenERC1155Tx.deploy();

    bridge = await upgrades.deployProxy(
      bridgeTx,
      [
        botMessenger.address,
        stablecoin.address,
        stargateToken.address,
        "Ala"
      ],
      {initializer:'initialize'}
    );

    await tokenERC20.deployed();
    await tokenERC20.initialize("Integral", "SFXDX", 18, bridge.address);

    await tokenERC721.deployed();
    await tokenERC1155.deployed();

    await bridge.deployed();

    for(let i=0; i<unames.length - 1; i++) {
        await stablecoin.mint(accounts[i].address, parseEther("100000"));
        await stablecoin.connect(accounts[i]).approve(bridge.address, parseEther("100000"));

        await stargateToken.mint(accounts[i].address, parseEther("100000"));
        await stargateToken.connect(accounts[i]).approve(bridge.address, parseEther("100000"));

        await transferToken.mint(accounts[i].address, parseEther("100000"));
        await transferToken.connect(accounts[i]).approve(bridge.address, parseEther("100000"));
    }
    await stargateToken.connect(accounts[3]).approve(bridge.address, parseEther("100000"));
    await transferToken.connect(accounts[3]).approve(bridge.address, parseEther("100000"));
    await stablecoin.connect(accounts[3]).approve(bridge.address, parseEther("100000"));
    //1ST = 1/15 USD | 1USD = 15 ST
    //1TT = 2 USD | 1USD = 1/2 TT 
    stargateAmountForOneUsd = parseEther("15");
    transferedTokensAmountForOneUsd = parseEther("0.5");

    getParams = ()=> {
        return {
          amount: 0,
          token: addressZero,
          tokenId: 0,
          receiver: addressZero,
          targetChain: "Ala",
          stargateAmountForOneUsd,
          transferedTokensAmountForOneUsd,
          payFeesWithST: true,
          nonce: 0,
          v: 0,
          r: 0,
          s: 0
        }
    }
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

  	it('Should lock native tokens', async() => {
  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;

      let STBalanceBefore = await stargateToken.balanceOf(client1.address);
      let nativeBalanceBefore = await ethers.provider.getBalance(client1.address);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      
      params = Object.assign(params, signature);     
  		let fee = await bridge.calcFeeScaled(
          amount,
          stargateAmountForOneUsd,
          transferedTokensAmountForOneUsd,
          params.payFeesWithST
      );
      // Transfer ether to the bridge and lock it there, pay fees with ST
      await expect(bridge.connect(client1).lockWithPermit(0, params, {value: amount}))
      .to.emit(bridge, "Lock")
      // First two parameters are indexed (hashed) in the event, so their value is uknown 
      .withArgs(0, anyValue, client1.address, amount, anyValue, anyValue, "Ala");

      let STBalanceAfter = await stargateToken.balanceOf(client1.address);
      let nativeBalanceAfter = await ethers.provider.getBalance(client1.address);
      let nativeBridgeBalance = await ethers.provider.getBalance(bridge.address);
      
      let expectedNativeBalance = nativeBalanceBefore.sub(amount);
      expect(STBalanceAfter).to.be.equal(STBalanceBefore.sub(fee));
      expect(nativeBridgeBalance).to.be.equal(amount);
      expect(nativeBalanceAfter).to.be.within(expectedNativeBalance.sub(EPSILON), expectedNativeBalance.add(EPSILON));

      params.nonce +=1;
      params.payFeesWithST = false;
      // Prepare new digest
      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);

      params = Object.assign(params, signature);     
  		fee = await bridge.calcFeeScaled(
          amount,
          stargateAmountForOneUsd,
          transferedTokensAmountForOneUsd,
          params.payFeesWithST
      );
      let sum = amount.add(fee);
      // Lock tokens but pay fees with native tokens this time
      await expect(bridge.connect(client1)
          .lockWithPermit(0, params, {value: sum})).to.emit(bridge, "Lock")
              .withArgs(0, anyValue, client1.address, amount, anyValue, anyValue, "Ala");

      let nativeBalanceAfterAfter = await ethers.provider.getBalance(client1.address);
      let nativeBridgeBalanceAfter = await ethers.provider.getBalance(bridge.address);
      
      expectedNativeBalance = nativeBalanceAfter.sub(amount).sub(fee);
      expect(nativeBridgeBalanceAfter).to.be.equal(amount.add(amount).add(fee));
      expect(nativeBalanceAfterAfter).to.be.within(expectedNativeBalance.sub(EPSILON), expectedNativeBalance.add(EPSILON));
    });

  	it('Should fail to lock native tokens if amount sent not equal amount in params', async() => {
  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).lockWithPermit(0, params, {value: amount.div("2")}))
          .to.be.revertedWith('Bridge: wrong native tokens amount');
    });

  	it('Should fail to lock native tokens if not enough tokens were sent to pay fees', async() => {
  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client3.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      // Not enough stargate tokens to pay fees for lock operation
      await expect(bridge.connect(client3).lockWithPermit(0, params, {value: amount}))
          .to.be.revertedWith('ERC20: transfer amount exceeds balance');

      params.payFeesWithST = false;
      // Not enough native tokens to pay fees for lock operation
      await expect(bridge.connect(client3).lockWithPermit(0, params, {value: amount}))
          .to.be.revertedWith(
              'Bridge: not enough native tokens were sent to cover the fees!'
          );
    });

    it('Should fail to lock same native tokens twice', async() => {
  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      // Two operations with same nonce
      await bridge.connect(client1).lockWithPermit(0, params, {value: amount})
      await expect(bridge.connect(client1).lockWithPermit(0, params, {value: amount}))
          .to.be.revertedWith("Bridge: request already processed!");
    });
         
    it('Should fail to lock native tokens with invalid signature', async() => {
  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      //wrong price
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd.div("2"), transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).lockWithPermit(0, params, {value: amount}))
          .to.be.revertedWith("Bridge: invalid signature!");
    });
    
    it('Should unlock native tokens to the user', async() => {

  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      //Lock some tokens
      await bridge.connect(client1).lockWithPermit(0, params, {value: amount})

      params.nonce +=1;
      params.amount = amount.div("2");

      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce);
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);

      let nativeBalanceBefore = await ethers.provider.getBalance(client1.address);
      await bridge.connect(client1).unlockWithPermit(0, params);
      let nativeBalanceAfter = await ethers.provider.getBalance(client1.address);
      let expectedBalance = nativeBalanceBefore.add(params.amount);
      expect(nativeBalanceAfter).to.be.within(expectedBalance.sub(EPSILON), expectedBalance.add(EPSILON));
    });

    it('Should fail to unlock native tokens if target chain differs', async () => {
      let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      //Lock some tokens
      await bridge.connect(client1).lockWithPermit(0, params, {value: amount})

      params.nonce +=1;
      params.amount = amount.div("2");

      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      params.targetChain = "Goerli"
      typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce);
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);

      await expect(bridge.connect(client1).unlockWithPermit(0, params))
        .to.be.revertedWith("Bridge: invalid signature!");
    })

  	it('Should fail to unlock native tokens if not enough tokens on the bridge', async() => {

  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).unlockWithPermit(0, params))
          .to.be.revertedWith("Bridge: not enough native tokens on the bridge balance!");
    });

    it('Should fail to unlock same native tokens twice', async() => {

  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      //Lock some tokens
      await bridge.connect(client1).lockWithPermit(0, params, {value: amount})

      params.nonce +=1;
      params.amount = amount.div("2");

      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce)
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await bridge.connect(client1).unlockWithPermit(0, params)
      await expect(bridge.connect(client1).unlockWithPermit(0, params))
          .to.be.revertedWith("Bridge: request already processed!");
    });

    it('Should fail to unlock native tokens with invalid signature', async() => {

  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      //Lock some tokens
      await bridge.connect(client1).lockWithPermit(0, params, {value: amount})

      params.nonce +=1;

      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      //wrong receiver
      typeHash = getPermitTypeHash(client2.address, params.amount, 0, params.targetChain, params.nonce)
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).unlockWithPermit(0, params))
          .to.be.revertedWith("Bridge: invalid signature!");
    });
  });

  describe("ERC20 Tokens", () => {

  	it('Should lock ERC20 tokens', async() => {
  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = transferToken.address;

      let STBalanceBefore = await stargateToken.balanceOf(client1.address);
      let TTBalanceBefore = await transferToken.balanceOf(client1.address);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      
      params = Object.assign(params, signature);     
  		let fee = await bridge.calcFeeScaled(
          amount,
          stargateAmountForOneUsd,
          transferedTokensAmountForOneUsd,
          params.payFeesWithST
      );
      // Transfer tokens to the bridge and lock it there, pay fees with ST
      await expect(bridge.connect(client1).lockWithPermit(1, params))
      .to.emit(bridge, "Lock")
      // First two parameters are indexed (hashed) in the event, so their value is uknown 
      .withArgs(1, anyValue, client1.address, amount, anyValue, anyValue, "Ala");

      let STBalanceAfter = await stargateToken.balanceOf(client1.address);
      let TTBalanceAfter = await transferToken.balanceOf(client1.address);
      let TTBridgeBalance = await transferToken.balanceOf(bridge.address);
      
      expect(STBalanceAfter).to.be.equal(STBalanceBefore.sub(fee));
      expect(TTBridgeBalance).to.be.equal(amount);
      expect(TTBalanceAfter).to.be.equal(STBalanceBefore.sub(amount));

      params.nonce +=1;
      params.payFeesWithST = false;
      // Prepare new digest
      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);

      params = Object.assign(params, signature);     
  		fee = await bridge.calcFeeScaled(
          amount,
          stargateAmountForOneUsd,
          transferedTokensAmountForOneUsd,
          params.payFeesWithST
      );
      // Lock tokens but pay fees with TT tokens this time
      await expect(bridge.connect(client1)
          .lockWithPermit(1, params)).to.emit(bridge, "Lock")
              .withArgs(1, anyValue, client1.address, amount, anyValue, anyValue, "Ala");

      let TTBalanceAfterAfter = await transferToken.balanceOf(client1.address);
      let TTBridgeBalanceAfter = await transferToken.balanceOf(bridge.address);
      expect(TTBridgeBalanceAfter).to.be.equal(amount.add(amount).add(fee));
      expect(TTBalanceAfterAfter).to.be.equal(TTBalanceAfter.sub(amount).sub(fee));
    });

  	it('Should fail to lock ERC20 tokens if not enough tokens were sent to pay fees', async() => {
  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client3.address;
      params.token = transferToken.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      // Not enough stargate tokens to pay fees for lock operation
      await expect(bridge.connect(client3).lockWithPermit(1, params))
          .to.be.revertedWith('ERC20: transfer amount exceeds balance');

      params.payFeesWithST = false;
      // Not enough TT tokens to pay fees for lock operation
      await expect(bridge.connect(client3).lockWithPermit(1, params))
          .to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('Should fail to lock same ERC20 tokens twice', async() => {
  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = transferToken.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      // Two operations with same nonce
      await bridge.connect(client1).lockWithPermit(1, params)
      await expect(bridge.connect(client1).lockWithPermit(1, params))
          .to.be.revertedWith("Bridge: request already processed!");
    });
         
    it('Should fail to lock ERC20 tokens with invalid signature', async() => {
  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = transferToken.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      //wrong price
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd.div("2"), transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).lockWithPermit(1, params))
          .to.be.revertedWith("Bridge: invalid signature!");
    });
    
    it('Should unlock ERC20 tokens to the user', async() => {

  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = transferToken.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      //Lock some tokens
      await bridge.connect(client1).lockWithPermit(1, params)

      params.nonce +=1;
      params.amount = amount.div("2");

      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce);
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      let TTBalanceBefore = await transferToken.balanceOf(client1.address);
      await bridge.connect(client1).unlockWithPermit(1, params);
      let TTBalanceAfter = await transferToken.balanceOf(client1.address);
      expect(TTBalanceAfter).to.be.equal(TTBalanceBefore.add(params.amount));
    });

    it('Should fail to unlock ERC20 tokens if target chain differs', async () => {
      let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = transferToken.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      //Lock some tokens
      await bridge.connect(client1).lockWithPermit(1, params)

      params.nonce +=1;
      params.amount = amount.div("2");

      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      params.targetChain = "Goerli"
      typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce);
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).unlockWithPermit(1, params))
        .to.be.revertedWith("Bridge: invalid signature!");
    })

  	it('Should fail to unlock ERC20 tokens if not enough tokens on the bridge', async() => {

  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = transferToken.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).unlockWithPermit(1, params))
          .to.be.revertedWith("Bridge: not enough ERC20 tokens on the bridge balance!");
    });

    it('Should fail to unlock same ERC20 tokens twice', async() => {

  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = transferToken.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      //Lock some tokens
      await bridge.connect(client1).lockWithPermit(1, params)

      params.nonce +=1;
      params.amount = amount.div("2");

      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce)
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await bridge.connect(client1).unlockWithPermit(1, params)
      await expect(bridge.connect(client1).unlockWithPermit(1, params))
          .to.be.revertedWith("Bridge: request already processed!");
    });

    it('Should fail to unlock ERC20 tokens with invalid signature', async() => {

  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = transferToken.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      //Lock some tokens
      await bridge.connect(client1).lockWithPermit(1, params)

      params.nonce +=1;

      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      //wrong receiver
      typeHash = getPermitTypeHash(client2.address, params.amount, 0, params.targetChain, params.nonce)
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).unlockWithPermit(1, params))
          .to.be.revertedWith("Bridge: invalid signature!");
    });

  	it('Should mint ERC20 tokens to users', async() => {

  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC20.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1)
          .mintWithPermit(1, params)).to.emit(bridge, "Mint")
              .withArgs(1, anyValue, client1.address, amount, anyValue, anyValue, "Ala");
      
      let wrappedBalance = await tokenERC20.balanceOf(client1.address);
      expect(wrappedBalance).to.be.equal(params.amount);
    });

    it("Should fail to mint ERC20 tokens if target chain differs", async () => {
      let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC20.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      params.targetChain = "Goerli"
      let typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      
      await expect(bridge.connect(client1).mintWithPermit(1, params))
        .to.be.revertedWith('Bridge: invalid signature!')
    })

    it('Should fail to mint ERC20 tokens with invalid signature', async() => {

  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC20.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      //wrong address
      let typeHash = getPermitTypeHash(client2.address, params.amount, 0, params.targetChain, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).mintWithPermit(1, params))
          .to.be.revertedWith("Bridge: invalid signature!");
    });

  	it('Should fail to mint ERC20 tokens with the same nonce', async() => {

  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC20.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await bridge.connect(client1).mintWithPermit(1, params);
      await expect(bridge.connect(client1).mintWithPermit(1, params))
          .to.be.revertedWith("Bridge: request already processed!");
    });

  	it('Should burn ERC20 tokens', async() => {
  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = transferToken.address;

      let STBalanceBefore = await stargateToken.balanceOf(client1.address);
      let TTBalanceBefore = await transferToken.balanceOf(client1.address);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      
      params = Object.assign(params, signature);     
  		let fee = await bridge.calcFeeScaled(
          amount,
          stargateAmountForOneUsd,
          transferedTokensAmountForOneUsd,
          params.payFeesWithST
      );
      // Burn tokens, pay fees with ST
      await expect(bridge.connect(client1).burnWithPermit(1, params))
      .to.emit(bridge, "Burn")
      // First two parameters are indexed (hashed) in the event, so their value is uknown 
      .withArgs(1, anyValue, client1.address, amount, anyValue, anyValue, "Ala");

      let STBalanceAfter = await stargateToken.balanceOf(client1.address);
      let TTBalanceAfter = await transferToken.balanceOf(client1.address);
      
      expect(STBalanceAfter).to.be.equal(STBalanceBefore.sub(fee));
      expect(TTBalanceAfter).to.be.equal(TTBalanceBefore.sub(amount));

      params.nonce +=1;
      params.payFeesWithST = false;
      // Prepare new digest
      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);

      params = Object.assign(params, signature);     
  		fee = await bridge.calcFeeScaled(
          amount,
          stargateAmountForOneUsd,
          transferedTokensAmountForOneUsd,
          params.payFeesWithST
      );
      // Burn tokens but pay fees with TT tokens this time
      await expect(bridge.connect(client1)
          .burnWithPermit(1, params)).to.emit(bridge, "Burn")
              .withArgs(1, anyValue, client1.address, amount, anyValue, anyValue, "Ala");

      let TTBalanceAfterAfter = await transferToken.balanceOf(client1.address);
      expect(TTBalanceAfterAfter).to.be.equal(TTBalanceAfter.sub(amount).sub(fee));
    });

  	it('Should fail to burn ERC20 tokens if user does not have enough tokens', async() => {

  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      await stargateToken.mint(client3.address, parseEther("0.5"));
      params.amount = amount;
      params.receiver = client3.address;
      params.token = transferToken.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client3).burnWithPermit(1, params))
          .to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it('Should fail to burn ERC20 tokens if not enought tokens were sent to pay fees', async() => {
  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client3.address;
      params.token = transferToken.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      // Not enough stargate tokens to pay fees for burn operation
      await expect(bridge.connect(client3).burnWithPermit(1, params))
          .to.be.revertedWith('ERC20: transfer amount exceeds balance');

      params.payFeesWithST = false;
      // Not enough TT tokens to pay fees for burn operation
      await expect(bridge.connect(client3).burnWithPermit(1, params))
          .to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('Should fail to burn ERC20 tokens with invalid signature', async() => {

  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = transferToken.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      //wrong price
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd.div("2"), transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).burnWithPermit(1, params))
          .to.be.revertedWith("Bridge: invalid signature!");
    });

  	it('Should fail to burn ERC20 tokens with the same nonce', async() => {

  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = transferToken.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await bridge.connect(client1).burnWithPermit(1, params);
      await expect(bridge.connect(client1).burnWithPermit(1, params))
          .to.be.revertedWith("Bridge: request already processed!");
    });
  });

  describe("ERC721 tokens", () => {

  	it('Should lock ERC721 tokens', async() => {
      let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC721.address;

      await tokenERC721.mint(client1.address, 0);
      await tokenERC721.mint(client1.address, 1);
      await tokenERC721.connect(client1).setApprovalForAll(bridge.address, true);

      let STBalanceBefore = await stargateToken.balanceOf(client1.address);
      let ERC721BalanceBefore = await tokenERC721.balanceOf(client1.address);
      let USDBalanceBefore = await stablecoin.balanceOf(client1.address);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      
      params = Object.assign(params, signature);     
  		let fee = await bridge.calcFeeFixed(
          amount,
          stargateAmountForOneUsd,
          params.payFeesWithST
      );
      // Transfer tokens to the bridge and lock it there, pay fees with ST
      await expect(bridge.connect(client1).lockWithPermit(2, params))
      .to.emit(bridge, "Lock")
      // First two parameters are indexed (hashed) in the event, so their value is uknown 
      .withArgs(2, anyValue, client1.address, params.amount, anyValue, anyValue, "Ala");

      let STBalanceAfter = await stargateToken.balanceOf(client1.address);
      let ERC721BalanceAfter = await tokenERC721.balanceOf(client1.address);
      let ERC721BridgeBalance = await tokenERC721.balanceOf(bridge.address);
      
      expect(STBalanceAfter).to.be.equal(STBalanceBefore.sub(fee));
      expect(ERC721BridgeBalance).to.be.equal(1);
      expect(ERC721BalanceAfter).to.be.equal(1);
      params.nonce +=1;
      params.tokenId = 1;
      params.payFeesWithST = false;
      // Prepare new digest
      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);

      params = Object.assign(params, signature);     
  		fee = await bridge.calcFeeFixed(
          amount,
          stargateAmountForOneUsd,
          params.payFeesWithST
      );
      // Lock tokens but pay fees with USD tokens this time
      await expect(bridge.connect(client1)
          .lockWithPermit(2, params)).to.emit(bridge, "Lock")
              .withArgs(2, anyValue, client1.address, params.amount, anyValue, anyValue, "Ala");

      let ERC721BalanceAfterAfter = await tokenERC721.balanceOf(client1.address);
      let ERC721BridgeBalanceAfter = await tokenERC721.balanceOf(bridge.address);
      let USDBalanceAfter = await stablecoin.balanceOf(client1.address);
      expect(ERC721BridgeBalanceAfter).to.be.equal(2);
      expect(ERC721BalanceAfterAfter).to.be.equal(0);
      expect(USDBalanceAfter).to.be.equal(USDBalanceBefore.sub(fee))
    });

  	it('Should fail to lock ERC721 tokens if not enough tokens were sent to pay fees', async() => {
  		let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client3.address;
      params.token = tokenERC721.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      // Not enough stargate tokens to pay fees for lock operation
      await expect(bridge.connect(client3).lockWithPermit(2, params))
          .to.be.revertedWith('ERC20: transfer amount exceeds balance');

      params.payFeesWithST = false;
      // Not enough USD tokens to pay fees for lock operation
      await expect(bridge.connect(client3).lockWithPermit(2, params))
          .to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('Should fail to lock same ERC721 tokens twice', async() => {
  		let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC721.address;

      await tokenERC721.mint(client1.address, 0);
      await tokenERC721.mint(client1.address, 1);
      await tokenERC721.connect(client1).setApprovalForAll(bridge.address, true);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      // Two operations with same nonce
      await bridge.connect(client1).lockWithPermit(2, params)
      await expect(bridge.connect(client1).lockWithPermit(2, params))
          .to.be.revertedWith("Bridge: request already processed!");
    });
         
    it('Should fail to lock ERC721 tokens with invalid signature', async() => {
  		let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC721.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      //wrong price
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd.div("2"), transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).lockWithPermit(2, params))
          .to.be.revertedWith("Bridge: invalid signature!");
    });
    
    it('Should unlock ERC721 tokens to the user', async() => {

  		let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC721.address;

      await tokenERC721.mint(client1.address, 0);
      await tokenERC721.mint(client1.address, 1);
      await tokenERC721.connect(client1).setApprovalForAll(bridge.address, true);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      //Lock some tokens
      await bridge.connect(client1).lockWithPermit(2, params);

      params.nonce +=1;

      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce);
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      let ERC721Balance = await tokenERC721.balanceOf(client1.address);
      expect(ERC721Balance).to.be.equal(1);
      await bridge.connect(client1).unlockWithPermit(2, params);
      ERC721Balance = await tokenERC721.balanceOf(client1.address);
      expect(ERC721Balance).to.be.equal(2);
    });

    it('Should fail to unlock ERC721 tokens if targer chain differs', async () => {
      let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC721.address;

      await tokenERC721.mint(client1.address, 0);
      await tokenERC721.mint(client1.address, 1);
      await tokenERC721.connect(client1).setApprovalForAll(bridge.address, true);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      //Lock some tokens
      await bridge.connect(client1).lockWithPermit(2, params);

      params.nonce +=1;

      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      params.targetChain = "Goerli"
      typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce);
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).unlockWithPermit(2, params))
        .to.be.revertedWith("Bridge: invalid signature!");
    })

  	it('Should fail to unlock ERC721 tokens if not enough tokens on the bridge', async() => {

  		let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC721.address;

      await tokenERC721.mint(client1.address, 0);
      await tokenERC721.mint(client1.address, 1);
      await tokenERC721.connect(client1).setApprovalForAll(bridge.address, true);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain,params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).unlockWithPermit(2, params))
          .to.be.revertedWith("Bridge: bridge doesn't own token with this ID!");
    });

    it('Should fail to unlock same ERC721 tokens twice', async() => {

  		let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC721.address;

      await tokenERC721.mint(client1.address, 0);
      await tokenERC721.mint(client1.address, 1);
      await tokenERC721.connect(client1).setApprovalForAll(bridge.address, true);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      //Lock some tokens
      await bridge.connect(client1).lockWithPermit(2, params)

      params.nonce +=1;

      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce)
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await bridge.connect(client1).unlockWithPermit(2, params)
      await expect(bridge.connect(client1).unlockWithPermit(2, params))
          .to.be.revertedWith("Bridge: request already processed!");
    });

    it('Should fail to unlock ERC721 tokens with invalid signature', async() => {

  		let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC721.address;

      await tokenERC721.mint(client1.address, 0);
      await tokenERC721.mint(client1.address, 1);
      await tokenERC721.connect(client1).setApprovalForAll(bridge.address, true);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      //Lock some tokens
      await bridge.connect(client1).lockWithPermit(2, params)

      params.nonce +=1;

      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      //wrong receiver
      typeHash = getPermitTypeHash(client2.address, params.amount, 0, params.targetChain, params.nonce)
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).unlockWithPermit(2, params))
          .to.be.revertedWith("Bridge: invalid signature!");
    });

  	it('Should mint ERC721 tokens to users', async() => {

  		let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC721.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1)
          .mintWithPermit(2, params)).to.emit(bridge, "Mint")
              .withArgs(2, anyValue, client1.address, amount, anyValue, anyValue, "Ala");
      
      let ERC721Balance = await tokenERC721.balanceOf(client1.address);
      expect(ERC721Balance).to.be.equal(1);
    });

    it("Should fail to mint ERC721 tokens if target chain differs", async () => {
      let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC721.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      params.targetChain = "Goerli"
      let typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      
      await expect(bridge.connect(client1).mintWithPermit(2, params))
        .to.be.revertedWith("Bridge: invalid signature!")
    })
 
    it('Should fail to mint ERC721 tokens with invalid signature', async() => {

  		let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC721.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      //wrong address
      let typeHash = getPermitTypeHash(client2.address, params.amount, 0, params.targetChain, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).mintWithPermit(2, params))
          .to.be.revertedWith("Bridge: invalid signature!");
    });

  	it('Should fail to mint ERC721 tokens with the same nonce', async() => {

  		let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC721.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await bridge.connect(client1).mintWithPermit(2, params);
      await expect(bridge.connect(client1).mintWithPermit(2, params))
          .to.be.revertedWith("Bridge: request already processed!");
    });

  	it('Should burn ERC721 tokens', async() => {
  		let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC721.address;
      let STBalanceBefore = await stargateToken.balanceOf(client1.address);
      let USDBalanceBefore = await stablecoin.balanceOf(client1.address);

      await tokenERC721.mint(client1.address, 0);
      await tokenERC721.mint(client1.address, 1);
      await tokenERC721.connect(client1).setApprovalForAll(bridge.address, true);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      
      params = Object.assign(params, signature);     
  		let fee = await bridge.calcFeeFixed(
          amount,
          stargateAmountForOneUsd,
          params.payFeesWithST
      );
      // Burn tokens, pay fees with ST
      await expect(bridge.connect(client1).burnWithPermit(2, params))
      .to.emit(bridge, "Burn")
      // First two parameters are indexed (hashed) in the event, so their value is uknown 
      .withArgs(2, anyValue, client1.address, amount, anyValue, anyValue, "Ala");

      let ERC721BalanceAfter = await tokenERC721.balanceOf(client1.address);
      let STBalanceAfter = await stargateToken.balanceOf(client1.address);
      
      expect(STBalanceAfter).to.be.equal(STBalanceBefore.sub(fee));
      expect(ERC721BalanceAfter).to.be.equal(1);

      params.nonce += 1;
      params.tokenId = 1;
      params.payFeesWithST = false;
      // Prepare new digest
      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);

      params = Object.assign(params, signature);     
  		fee = await bridge.calcFeeFixed(
          amount,
          stargateAmountForOneUsd,
          params.payFeesWithST
      );
      // Burn tokens but pay fees with USD tokens this time
      await expect(bridge.connect(client1)
          .burnWithPermit(2, params)).to.emit(bridge, "Burn")
              .withArgs(2, anyValue, client1.address, amount, anyValue, anyValue, "Ala");

      let USDBalanceAfter = await stablecoin.balanceOf(client1.address);
      expect(USDBalanceAfter).to.be.equal(USDBalanceBefore.sub(fee));
    });

  	it('Should fail to burn ERC721 tokens if user does not have enough tokens', async() => {

  		let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC721.address;

      await tokenERC721.mint(client2.address, 0);
      await tokenERC721.mint(client2.address, 1);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).burnWithPermit(2, params))
          .to.be.revertedWith("Bridge: cannot burn ERC721, msg.sender not owner");
    });

    it('Should fail to burn ERC721 tokens if not enought tokens were sent to pay fees', async() => {

  		let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client3.address;
      params.token = tokenERC721.address;

      await tokenERC721.mint(client3.address, 0);
      await tokenERC721.mint(client3.address, 1);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      // Not enough stargate tokens to pay fees for burn operation
      await expect(bridge.connect(client3).burnWithPermit(2, params))
          .to.be.revertedWith('ERC20: transfer amount exceeds balance');

      params.payFeesWithST = false;
      // Not enough TT tokens to pay fees for burn operation
      await expect(bridge.connect(client3).burnWithPermit(2, params))
          .to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('Should fail to burn ERC721 tokens with invalid signature', async() => {

  		let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC721.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      //wrong price
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd.div("2"), transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).burnWithPermit(2, params))
          .to.be.revertedWith("Bridge: invalid signature!");
    });

  	it('Should fail to burn ERC721 tokens with the same nonce', async() => {

  		let amount = 1;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC721.address;

      await tokenERC721.mint(client1.address, 0);
      await tokenERC721.mint(client1.address, 1);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await bridge.connect(client1).burnWithPermit(2, params);
      await expect(bridge.connect(client1).burnWithPermit(2, params))
          .to.be.revertedWith("Bridge: request already processed!");
    });
  });

  describe("ERC1155 tokens", () => {

  	it('Should lock ERC1155 tokens', async() => {
      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC1155.address;

      await tokenERC1155.mint(client1.address, 0, 10);
      await tokenERC1155.connect(client1).setApprovalForAll(bridge.address, true);

      let STBalanceBefore = await stargateToken.balanceOf(client1.address);
      let ERC1155BalanceBefore = await tokenERC1155.balanceOf(client1.address, 0);
      let USDBalanceBefore = await stablecoin.balanceOf(client1.address);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      
      params = Object.assign(params, signature);     
  		let fee = await bridge.calcFeeFixed(
          amount,
          stargateAmountForOneUsd,
          params.payFeesWithST
      );
      // Transfer tokens to the bridge and lock it there, pay fees with ST
      await expect(bridge.connect(client1).lockWithPermit(3, params))
      .to.emit(bridge, "Lock")
      // First two parameters are indexed (hashed) in the event, so their value is uknown 
      .withArgs(3, anyValue, client1.address, params.amount, anyValue, anyValue, "Ala");

      let STBalanceAfter = await stargateToken.balanceOf(client1.address);
      let ERC1155BalanceAfter = await tokenERC1155.balanceOf(client1.address, 0);
      let ERC1155BridgeBalance = await tokenERC1155.balanceOf(bridge.address, 0);
      
      expect(STBalanceAfter).to.be.equal(STBalanceBefore.sub(fee));
      expect(ERC1155BridgeBalance).to.be.equal(amount);
      expect(ERC1155BalanceAfter).to.be.equal(5);
      params.nonce +=1;
      params.payFeesWithST = false;
      // Prepare new digest
      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);

      params = Object.assign(params, signature);     
  		fee = await bridge.calcFeeFixed(
          amount,
          stargateAmountForOneUsd,
          params.payFeesWithST
      );
      // Lock tokens but pay fees with USD tokens this time
      await expect(bridge.connect(client1)
          .lockWithPermit(3, params)).to.emit(bridge, "Lock")
              .withArgs(3, anyValue, client1.address, params.amount, anyValue, anyValue, "Ala");

      let ERC1155BalanceAfterAfter = await tokenERC1155.balanceOf(client1.address, 0);
      let ERC1155BridgeBalanceAfter = await tokenERC1155.balanceOf(bridge.address, 0);
      let USDBalanceAfter = await stablecoin.balanceOf(client1.address);
      expect(ERC1155BridgeBalanceAfter).to.be.equal(10);
      expect(ERC1155BalanceAfterAfter).to.be.equal(0);
      expect(USDBalanceAfter).to.be.equal(USDBalanceBefore.sub(fee))
    });

  	it('Should fail to lock ERC1155 tokens if not enough tokens were sent to pay fees', async() => {
      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client3.address;
      params.token = tokenERC1155.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      // Not enough stargate tokens to pay fees for lock operation
      await expect(bridge.connect(client3).lockWithPermit(3, params))
          .to.be.revertedWith('ERC20: transfer amount exceeds balance');

      params.payFeesWithST = false;
      // Not enough USD tokens to pay fees for lock operation
      await expect(bridge.connect(client3).lockWithPermit(3, params))
          .to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('Should fail to lock same ERC1155 tokens twice', async() => {
      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client3.address;
      params.token = tokenERC1155.address;

      await tokenERC1155.mint(client1.address, 0, 10);
      await tokenERC1155.connect(client1).setApprovalForAll(bridge.address, true);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      // Two operations with same nonce
      await bridge.connect(client1).lockWithPermit(3, params)
      await expect(bridge.connect(client1).lockWithPermit(3, params))
          .to.be.revertedWith("Bridge: request already processed!");
    });
         
    it('Should fail to lock ERC1155 tokens with invalid signature', async() => {
      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client3.address;
      params.token = tokenERC1155.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      //wrong price
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd.div("2"), transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).lockWithPermit(3, params))
          .to.be.revertedWith("Bridge: invalid signature!");
    });
    
    it('Should unlock ERC1155 tokens to the user', async() => {

      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC1155.address;

      await tokenERC1155.mint(client1.address, 0, 10);
      await tokenERC1155.connect(client1).setApprovalForAll(bridge.address, true);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      //Lock some tokens
      await bridge.connect(client1).lockWithPermit(3, params);

      params.nonce +=1;

      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce);
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      let ERC1155Balance = await tokenERC1155.balanceOf(client1.address, 0);
      expect(ERC1155Balance).to.be.equal(5);
      await bridge.connect(client1).unlockWithPermit(3, params);
      ERC1155Balance = await tokenERC1155.balanceOf(client1.address, 0);
      expect(ERC1155Balance).to.be.equal(10);
    });

    it('Should fail to unlock ERC1155 tokens if target chain differs', async () => {
      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC1155.address;

      await tokenERC1155.mint(client1.address, 0, 10);
      await tokenERC1155.connect(client1).setApprovalForAll(bridge.address, true);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      //Lock some tokens
      await bridge.connect(client1).lockWithPermit(3, params);

      params.nonce +=1;

      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      params.targetChain = "Goerli";
      typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce);
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).unlockWithPermit(3, params))
        .to.be.revertedWith("Bridge: invalid signature!");
    })

  	it('Should fail to unlock ERC1155 tokens if not enough tokens on the bridge', async() => {

      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC1155.address;

      await tokenERC1155.mint(client1.address, 0, 10);
      await tokenERC1155.connect(client1).setApprovalForAll(bridge.address, true);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).unlockWithPermit(3, params))
          .to.be.revertedWith("Bridge: not enough ERC1155 tokens on the bridge balance!");
    });

    it('Should fail to unlock same ERC1155 tokens twice', async() => {

      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC1155.address;

      await tokenERC1155.mint(client1.address, 0, 10);
      await tokenERC1155.connect(client1).setApprovalForAll(bridge.address, true);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      //Lock some tokens
      await bridge.connect(client1).lockWithPermit(3, params)

      params.nonce +=1;

      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce)
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await bridge.connect(client1).unlockWithPermit(3, params)
      await expect(bridge.connect(client1).unlockWithPermit(3, params))
          .to.be.revertedWith("Bridge: request already processed!");
    });

    it('Should fail to unlock ERC1155 tokens with invalid signature', async() => {

      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC1155.address;

      await tokenERC1155.mint(client1.address, 0, 10);
      await tokenERC1155.connect(client1).setApprovalForAll(bridge.address, true);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     
      //Lock some tokens
      await bridge.connect(client1).lockWithPermit(3, params)

      params.nonce +=1;

      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      //wrong receiver
      typeHash = getPermitTypeHash(client2.address, params.amount, 0, params.targetChain, params.nonce)
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).unlockWithPermit(3, params))
          .to.be.revertedWith("Bridge: invalid signature!");
    });

  	it('Should mint ERC1155 tokens to users', async() => {

      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC1155.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1)
          .mintWithPermit(3, params)).to.emit(bridge, "Mint")
              .withArgs(3, anyValue, client1.address, amount, anyValue, anyValue, "Ala");
      
      let ERC1155Balance = await tokenERC1155.balanceOf(client1.address, 0);
      expect(ERC1155Balance).to.be.equal(params.amount);
    });

    it('Should fail to mint ERC1155 tokens if target chain differs', async () => {
      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC1155.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      params.targetChain = "Goerli"
      let typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).mintWithPermit(3, params))
        .to.be.revertedWith("Bridge: invalid signature!")
    })

    it('Should fail to mint ERC1155 tokens with invalid signature', async() => {

      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC1155.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      //wrong address
      let typeHash = getPermitTypeHash(client2.address, params.amount, 0, params.targetChain, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).mintWithPermit(3, params))
          .to.be.revertedWith("Bridge: invalid signature!");
    });

  	it('Should fail to mint ERC1155 tokens with the same nonce', async() => {

      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC1155.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getPermitTypeHash(client1.address, params.amount, 0, params.targetChain, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await bridge.connect(client1).mintWithPermit(3, params);
      await expect(bridge.connect(client1).mintWithPermit(3, params))
          .to.be.revertedWith("Bridge: request already processed!");
    });

  	it('Should burn ERC1155 tokens', async() => {
      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC1155.address;

      await tokenERC1155.mint(client1.address, 0, 10);
      await tokenERC1155.connect(client1).setApprovalForAll(bridge.address, true);

      let STBalanceBefore = await stargateToken.balanceOf(client1.address);
      let ERC1155BalanceBefore = await tokenERC1155.balanceOf(client1.address, 0);
      let USDBalanceBefore = await stablecoin.balanceOf(client1.address);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      
      params = Object.assign(params, signature);     
  		let fee = await bridge.calcFeeFixed(
          amount,
          stargateAmountForOneUsd,
          params.payFeesWithST
      );
      // Burn tokens, pay fees with ST
      await expect(bridge.connect(client1).burnWithPermit(3, params))
      .to.emit(bridge, "Burn")
      // First two parameters are indexed (hashed) in the event, so their value is uknown 
      .withArgs(3, anyValue, client1.address, amount, anyValue, anyValue, "Ala");

      let ERC1155BalanceAfter = await tokenERC1155.balanceOf(client1.address, 0);
      let STBalanceAfter = await stargateToken.balanceOf(client1.address);
      
      expect(STBalanceAfter).to.be.equal(STBalanceBefore.sub(fee));
      expect(ERC1155BalanceAfter).to.be.equal(5);

      params.nonce += 1;
      params.payFeesWithST = false;
      // Prepare new digest
      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);

      params = Object.assign(params, signature);     
  		fee = await bridge.calcFeeFixed(
          amount,
          stargateAmountForOneUsd,
          params.payFeesWithST
      );
      // Burn tokens but pay fees with USD tokens this time
      await expect(bridge.connect(client1)
          .burnWithPermit(3, params)).to.emit(bridge, "Burn")
              .withArgs(3, anyValue, client1.address, amount, anyValue, anyValue, "Ala");

      let USDBalanceAfter = await stablecoin.balanceOf(client1.address);
      expect(USDBalanceAfter).to.be.equal(USDBalanceBefore.sub(fee));
    });

  	it('Should fail to burn ERC1155 tokens if user does not have enough tokens', async() => {
      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC1155.address;

      await tokenERC1155.mint(client2.address, 0, 10);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).burnWithPermit(3, params))
          .to.be.revertedWith("ERC1155: burn amount exceeds balance");
    });

    it('Should fail to burn ERC1155 tokens if not enought tokens were sent to pay fees', async() => {
      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client3.address;
      params.token = tokenERC1155.address;

      await tokenERC1155.mint(client3.address, 0, 10);
      await tokenERC1155.connect(client3).setApprovalForAll(bridge.address, true);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      // Not enough stargate tokens to pay fees for burn operation
      await expect(bridge.connect(client3).burnWithPermit(2, params))
          .to.be.revertedWith('ERC20: transfer amount exceeds balance');

      params.payFeesWithST = false;
      // Not enough TT tokens to pay fees for burn operation
      await expect(bridge.connect(client3).burnWithPermit(2, params))
          .to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });

    it('Should fail to burn ERC1155 tokens with invalid signature', async() => {
      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC1155.address;

      await tokenERC1155.mint(client1.address, 0, 10);
      await tokenERC1155.connect(client1).setApprovalForAll(bridge.address, true);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      //wrong price
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd.div("2"), transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await expect(bridge.connect(client1).burnWithPermit(3, params))
          .to.be.revertedWith("Bridge: invalid signature!");
    });

  	it('Should fail to burn ERC1155 tokens with the same nonce', async() => {
      let amount = 5;
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;
      params.token = tokenERC1155.address;

      await tokenERC1155.mint(client1.address, 0, 10);
      await tokenERC1155.connect(client1).setApprovalForAll(bridge.address, true);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      params = Object.assign(params, signature);     

      await bridge.connect(client1).burnWithPermit(3, params);
      await expect(bridge.connect(client1).burnWithPermit(3, params))
          .to.be.revertedWith("Bridge: request already processed!");
    });
  });


	describe("Helper Functions", async () => {

		it('Should set new admin', async() => {
      // Client does not have admin rights here
      await expect(bridge.connect(client1).setSupportedChain("Ala"))
      .to.be.revertedWith("Bridge: the caller is not an admin!");
      await expect(bridge.setAdmin(client1.address))
      .to.emit(bridge, "SetAdmin").withArgs(anyValue);
      // Now he does
      await bridge.connect(client1).setSupportedChain("Ala");
	  });

    it('Should fail to set new admin with invalid address', async() => {
      await expect(bridge.setAdmin(addressZero))
        .to.be.revertedWith("Bridge: new admin can not have a zero address!");
    });

		it('Should calculate fee amount correctly', async() => {
      //fees    ERC20 & Native                        ERC721 & ERC1155
      //ST      $0.0075 < 0.225% in USD eq < $0.15    $0.2 eq
      //TT      $0.01 < 0.3% in USD eq < $0.2         NA
      //TT*     0.3%                                  NA
      //USD     NA                                    $0.3
      //* - No USD price for TT
      //
      //EXAMPLE
      //
      //1ST = 1/15 USD | 1USD = 15 ST
      //1TT = 2 USD | 1USD = 1/2 TT 
      //We lock 10 TT tokens                          //We lock 1 NFT
      //Fee in ST                                     Fee in ST
      //TT -> USD -> ST                               
      //10 * 2 * 0.225 / 100 * 15 = 0.675ST           15 * 0.2 = 3ST
      //Fee in TT                                     Fee in USD
      //TT -> USD
      //10 * 2 * 0.3 / 100 / 2 = 0.03TT               0.3USD
      let amount = parseEther("10");
      //calculate ERC20/Native fee
      let feeST = await bridge.calcFeeScaled(
        amount,
        stargateAmountForOneUsd,
        transferedTokensAmountForOneUsd,
        true
      )
      let feeTT = await bridge.calcFeeScaled(
        amount,
        stargateAmountForOneUsd,
        transferedTokensAmountForOneUsd,
        false
      )
      let feeTTNoData = await bridge.calcFeeScaled(
        amount,
        stargateAmountForOneUsd,
        0,
        false
      )
      expect(feeST).to.be.equal(parseEther("0.675"));
      expect(feeTT).to.be.equal(parseEther("0.03"));
      expect(feeTTNoData).to.be.equal(parseEther("0.03"));

      amount = 1;
      //calculate ERC721/1155 fee
      feeST = await bridge.calcFeeFixed(
        amount,
        stargateAmountForOneUsd,
        true
      )
      let feeUSD = await bridge.calcFeeFixed(
        amount,
        stargateAmountForOneUsd,
        false
      )
      expect(feeST).to.be.equal(parseEther("3"));
      expect(feeUSD).to.be.equal(parseEther("0.3"));

      //Edge cases
      amount = parseEther("1.6");
      feeST = await bridge.calcFeeScaled(
        amount,
        stargateAmountForOneUsd,
        transferedTokensAmountForOneUsd,
        true
      )
      //0.00775 USD = 0.1125 ST
      expect(feeST).to.be.equal(parseEther("0.1125"))
      amount = parseEther("33.35");
      feeST = await bridge.calcFeeScaled(
        amount,
        stargateAmountForOneUsd,
        transferedTokensAmountForOneUsd,
        true
      )
      //0.15 USD = 2.25 ST
      expect(feeST).to.be.equal(parseEther("2.25"))
      amount = parseEther("1.665");
      feeTT = await bridge.calcFeeScaled(
        amount,
        stargateAmountForOneUsd,
        transferedTokensAmountForOneUsd,
        false
      )
      //0.01 USD = 0.005 TT
      expect(feeTT).to.be.equal(parseEther("0.005"))
      amount = parseEther("33.35");
      feeTT = await bridge.calcFeeScaled(
        amount,
        stargateAmountForOneUsd,
        transferedTokensAmountForOneUsd,
        false
      )
      //0.2 USD = 0.1 TT
      expect(feeTT).to.be.equal(parseEther("0.1"))
	  });

		it('Should collect fees from tokens transactions', async() => {
  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;

      let STBalanceBefore = await stargateToken.balanceOf(owner.address);

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      
      params = Object.assign(params, signature);     
  		let fee = await bridge.calcFeeScaled(
          amount,
          stargateAmountForOneUsd,
          transferedTokensAmountForOneUsd,
          params.payFeesWithST
      );
      // Transfer ether to the bridge and lock it there, pay fees with ST
      await bridge.connect(client1).lockWithPermit(0, params, {value: amount})
      // Withdraw ST fees
      await bridge.withdraw(stargateToken.address, fee);
      let STBalanceAfter = await stargateToken.balanceOf(owner.address);
      expect(STBalanceAfter).to.be.equal(STBalanceBefore.add(fee))

      params.nonce +=1;
      params.payFeesWithST = false;
      // Prepare new digest
      domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      permitDigest = getPermitDigest(domainSeparator, typeHash);
      signature = getSignatureFromDigest(permitDigest, botMessenger);

      params = Object.assign(params, signature);     
  		fee = await bridge.calcFeeScaled(
          amount,
          stargateAmountForOneUsd,
          transferedTokensAmountForOneUsd,
          params.payFeesWithST
      );
      let sum = amount.add(fee);
      // Lock tokens but pay fees with native tokens this time
      let ownerNativeBalanceBefore = await ethers.provider.getBalance(owner.address);
      await bridge.connect(client1).lockWithPermit(0, params, {value: sum});
      // Withdraw fees in native tokens
      await bridge.withdraw(params.token, fee);
      let ownerNativeBalanceAfter = await ethers.provider.getBalance(owner.address);
      let expectedBalance = ownerNativeBalanceBefore.add(fee)
      expect(ownerNativeBalanceAfter).to.be.within(expectedBalance.sub(EPSILON), expectedBalance.add(EPSILON));
	  });

		it('Should fail to collect fees from tokens with no transactions ', async() => {

      // Collect fees right away
      let feeToWithDraw = ethers.utils.parseEther("0.03");

      await expect(bridge.withdraw(addressZero, feeToWithDraw))
      .to.be.revertedWith("Bridge: no fees were collected for this token!");

	  });

		it('Should fail to collect too high fees ', async() => {
  		let amount = ethers.utils.parseEther('1');
      let params = getParams();
      params.amount = amount;
      params.receiver = client1.address;

  		await bridge.setSupportedChain("Ala");
      let domainSeparator = getDomainSeparator('1', chainId, bridge.address);
      let typeHash = getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, params.nonce)
      let permitDigest = getPermitDigest(domainSeparator, typeHash);
      let signature = getSignatureFromDigest(permitDigest, botMessenger);
      
      params = Object.assign(params, signature);     
  		let fee = await bridge.calcFeeScaled(
          amount,
          stargateAmountForOneUsd,
          transferedTokensAmountForOneUsd,
          params.payFeesWithST
      );
      // Transfer ether to the bridge and lock it there, pay fees with ST
      await bridge.connect(client1).lockWithPermit(0, params, {value: amount})
      // Withdraw ST fees
      await expect(bridge.withdraw(stargateToken.address, fee.mul("2")))
          .to.be.revertedWith("Bridge: amount of fees to withdraw is too large!");
	  });

		it('Should add and remove supported chains', async() => {

      // Forbid transactions on Ala chain
      await expect(bridge.removeSupportedChain("Ala"))
      .to.emit(bridge, "RemoveChain").withArgs(anyValue);

      // Allow transactions on Ala chain
      await expect(bridge.setSupportedChain("Ala"))
      .to.emit(bridge, "SetNewChain").withArgs(anyValue);
	  });

		it('reverts on init with zero addresses args', async() => {
      await expect(upgrades.deployProxy(
        bridgeTx,
        [
          addressZero,
          stablecoin.address,
          stargateToken.address,
          "Ala"
        ],
        {initializer:'initialize'}
      )).to.be.revertedWith("Bridge: default bot messenger can not be zero address!");

      await expect(upgrades.deployProxy(
        bridgeTx,
        [
          botMessenger.address,
          addressZero,
          stargateToken.address,
          "Ala"
        ],
        {initializer:'initialize'}
      )).to.be.revertedWith("Bridge: stablecoin can not be zero address!");

      await expect(upgrades.deployProxy(
        bridgeTx,
        [
          botMessenger.address,
          stablecoin.address,
          addressZero,
          "Ala"
        ],
        {initializer:'initialize'}
      )).to.be.revertedWith("Bridge: stargate token can not be zero address!");
    });
	});
});
