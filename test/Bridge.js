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

  describe("Bridge", function () {
  	it('Should lock native tokens', async() => {

  		let amount = ethers.utils.parseEther('1');
  		let fee = await bridge.calcFee(amount);
  		let sum = amount.add(fee);

      await bridge.setSupportedChain("Ala");

      await expect(await bridge.lock(addressZero, amount, clientAcc1.address, "Ala", {value: sum}))
        .to.emit(bridge, "Lock")
        // First three parameters are indexed (hashed) in the event, so their value is uknown 
        .withArgs(anyValue, anyValue, anyValue, amount, "Ala");

    });

    it('Should lock ERC20 tokens', async() => {

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
      await expect(await bridge.connect(clientAcc1).burn(token.address, amount, clientAcc1.address, "ETH"))
        .to.emit(bridge, "Burn")
        // First three parameters are indexed (hashed) in the event, so their value is uknown 
        .withArgs(anyValue, anyValue, anyValue, amount, "ETH");

    });
  // 	it('burn token', async() => {
  // 		await factoryToken.connect(owner).createNewToken("TestToken1", "TT1", 8);
  // 		[address1] = await factoryToken.getAllowedTokens();
  // 		token1 = await ethers.getContractAt('IWrappedERC20', address1);
  // 		let amount = ethers.utils.parseEther('1000');
  // 		let amountWithoutFee = ethers.utils.parseEther('997');
  //       //chainId = 1 for Ethereum mainnet
  //       DOMAIN_SEPARATOR = getDomainSeparator((await token1.name()), '1', chainId, bridge.address);
  //       const permitDigest = getPermitDigest(DOMAIN_SEPARATOR, client.address, amount, 0);
  //       let sign = getSignatureWithPermit(permitDigest, bot_messenger);

  //       await bridge.setAllowedToken(token1.address, "");
  //       await bridge.setSupportedChain("Ala");

  //       await bridge.connect(client).mintWithPermit(token1.address, amount, 0, sign.v, sign.r, sign.s);

  //       await token1.connect(client).approve(bridge.address, amount);
  //       await expect(bridge.connect(client).burn(token1.address, "0x07B0C0f1EE1eC64A80293A1698Eb73C77E54Aae9", amount, "BSC"))
  //       .to.revertedWith("Not supported");

  //       await expect(bridge.connect(client).burn(token1.address, "0x07B0C0f1EE1eC64A80293A1698Eb73C77E54Aae9", amount, "Ala"))
  //       .to.emit(bridge, "Burn").withArgs(token1.address, client.address, "0x07B0C0f1EE1eC64A80293A1698Eb73C77E54Aae9", amountWithoutFee, "Ala");
  //     });
  // 	it('mintWithPermit function', async() => {
  // 		await factoryToken.createNewToken("TestToken1", "TT1", 8);
  // 		[address1] = await factoryToken.getAllowedTokens();
  // 		token1 = await ethers.getContractAt('IWrappedERC20', address1);

  // 		DOMAIN_SEPARATOR = getDomainSeparator((await token1.name()), '1', chainId, bridge.address);
  // 		const permitDigest = getPermitDigest(DOMAIN_SEPARATOR, client.address, ethers.utils.parseEther('1000'), 0);
  // 		let sign = getSignatureWithPermit(permitDigest, bot_messenger);

  // 		await bridge.setAllowedToken(address1, "");

  // 		await expect(bridge.connect(client).mintWithPermit(
  // 			token1.address,
  // 			ethers.utils.parseEther('2000'),
  // 			0,
  // 			sign.v,
  // 			sign.r,
  // 			sign.s)).to.revertedWith("Invalid signature");

  // 		await expect(bridge.connect(owner).mintWithPermit(
  // 			token1.address,
  // 			ethers.utils.parseEther('1000'),
  // 			0,
  // 			sign.v,
  // 			sign.r,
  // 			sign.s)).to.revertedWith("Invalid signature");

  // 		expect(await bridge.connect(client).mintWithPermit(
  // 			token1.address,
  // 			ethers.utils.parseEther('1000'),
  // 			0,
  // 			sign.v,
  // 			sign.r,
  // 			sign.s
  // 			)).to.emit(bridge, "MintWithPermit").withArgs(token1.address, client.address, ethers.utils.parseEther('1000'));

  // 		await expect(bridge.connect(client).mintWithPermit(
  // 			token1.address,
  // 			ethers.utils.parseEther('1000'),
  // 			0,
  // 			sign.v,
  // 			sign.r,
  // 			sign.s)).to.revertedWith("Request already processed");


  // 		expect(await token1.balanceOf(client.address)).to.be.equal(ethers.utils.parseEther('1000'));
  // 	});
  // 	it('unlockWithPermit token function', async() => {

  // 		const amount = ethers.utils.parseEther('100');
  // 		const TokenLock = await ethers.getContractFactory("TokenMock");
  // 		var tokenLock = await TokenLock.deploy("TokenLock", "TL", amount, bridge.address);

  // 		DOMAIN_SEPARATOR = getDomainSeparator((await tokenLock.name()), '1', chainId, bridge.address);
  // 		const permitDigest = getPermitDigest(DOMAIN_SEPARATOR, client.address, amount, 0);
  // 		let sign = getSignatureWithPermit(permitDigest, bot_messenger);

  // 		await bridge.setAllowedToken(tokenLock.address, "");
  // 		expect(await bridge.connect(client).unlockWithPermit(
  // 			tokenLock.address,
  // 			amount,
  // 			0,
  // 			sign.v,
  // 			sign.r,
  // 			sign.s)).to.emit(bridge, "UnlockWithPermit")
  // 		.withArgs(tokenLock.address, client.address, amount);

  // 		await expect(bridge.connect(client).unlockWithPermit(
  // 			tokenLock.address,
  // 			amount,
  // 			0,
  // 			sign.v,
  // 			sign.r,
  // 			sign.s)).to.revertedWith("Request already processed");
  // 	});

  // 	it('unlockWithPermit ETH function', async() => {
  // 		const amount = ethers.utils.parseEther('1');
  // 		const amountUnlock = ethers.utils.parseEther('0.5');
  // 		await bridge.setAllowedToken(ethers.constants.AddressZero, "Ethereum");
  // 		await bridge.setSupportedChain("Ala");
  // 		await bridge.connect(client).lock(ethers.constants.AddressZero, "0x07B0C0f1EE1eC64A80293A1698Eb73C77E54Aae9", 0, "Ala", {value: ethers.utils.parseEther("10")});

  // 		DOMAIN_SEPARATOR = getDomainSeparator("Ethereum", '1', chainId, bridge.address);
  // 		const permitDigest = getPermitDigest(DOMAIN_SEPARATOR, client.address, amountUnlock, 0);
  // 		let sign = getSignatureWithPermit(permitDigest, bot_messenger);

  // 		expect(await bridge.connect(client).unlockWithPermit(
  // 			ethers.constants.AddressZero,
  // 			amountUnlock,
  // 			0,
  // 			sign.v,
  // 			sign.r,
  // 			sign.s)).to.emit(bridge, "UnlockWithPermit")
  // 		.withArgs(ethers.constants.AddressZeroaddress, client.address, amountUnlock);

  // 		await expect(bridge.connect(client).unlockWithPermit(
  // 			ethers.constants.AddressZero,
  // 			amount,
  // 			0,
  // 			sign.v,
  // 			sign.r,
  // 			sign.s)).to.revertedWith("Request already processed");

  // 		await expect(bridge.connect(owner).mintWithPermit(
  // 			ethers.constants.AddressZero,
  // 			amount,
  // 			0,
  // 			sign.v,
  // 			sign.r,
  // 			sign.s)).to.revertedWith("Invalid signature");
  // 	});
		// it('setBridgedStandardERC20 function', async() => {
		// 	const WrappedERC20Other = await ethers.getContractFactory("WrappedERC20");
		// 	tokenStandart2 = await WrappedERC20Other.deploy();
		// 	factoryToken2 = await WrappedERC20Other.deploy(tokenStandart2.address, bridge.address);

		// 	expect(await bridge.wrappedToken()).to.be.equal(tokenStandart.address);
		// 	await bridge.setBridgedStandardERC20(tokenStandart2.address);
		// 	expect(await bridge.wrappedToken()).to.be.equal(tokenStandart2.address);

		// 	await expect(bridge.connect(client).setBridgedStandardERC20(tokenStandart2.address))
		// 	.to.revertedWith("onlyAdmin");
		// 	await expect(bridge.setBridgedStandardERC20(ethers.constants.AddressZero))
		// 	.to.revertedWith("The address is null");

		// });
		// it('allowedToken function', async() => {
		// 	const TokenLock = await ethers.getContractFactory("TokenMock");
		// 	var tokenLock = await TokenLock.deploy("TokenLock", "TL", 100000, bridge.address);
		// 	DOMAIN_SEPARATOR = getDomainSeparator((await tokenLock.name()), '1', chainId, bridge.address);
		// 	DOMAIN_SEPARATOR_ETH = getDomainSeparator(("Ethereum"), '1', chainId, bridge.address);
		// 	console.log(hre.network.config.chainId);
		// 	await bridge.setAllowedToken(tokenLock.address, "");

		// 	await expect(bridge.connect(client).setAllowedToken(tokenLock.address, ""))
		// 	.to.revertedWith("onlyAdmin");

		// 	expect(await bridge.allowedTokens(tokenLock.address)).to.be.equal(DOMAIN_SEPARATOR);

		// 	await bridge.setAllowedToken(ethers.constants.AddressZero, "Ethereum");
		// 	expect(await bridge.allowedTokens(ethers.constants.AddressZero))
		// 	.to.be.equal(DOMAIN_SEPARATOR_ETH);

		// 	await expect(bridge.setAllowedToken(ethers.constants.AddressZero, ""))
		// 	.to.revertedWith("Name is empty");

		// 	await bridge.removeAllowedToken(tokenLock.address);
		// 	expect(await bridge.allowedTokens(tokenLock.address))
		// 	.to.be.equal(ethers.utils.hexZeroPad(ethers.utils.hexlify(0), 32));
		// });

		// it('setFeeRate function', async() => {
		// 	await expect(bridge.connect(client).setFeeRate(10)).to.revertedWith("onlyAdmin");
		// 	await expect(bridge.setFeeRate(1000000)).to.revertedWith("Out of range");
		// 	await expect(bridge.setFeeRate(0)).to.revertedWith("Out of range");

		// 	await bridge.setFeeRate(100);
		// 	expect(await bridge.feeRate()).to.be.equal(100);
		// });

		// it('SupportedChain function', async() => {
		// 	await expect(bridge.connect(client).setSupportedChain("BSC")).to.revertedWith("onlyAdmin");

		// 	expect(await bridge.supportedChains("BSC")).to.be.false;
		// 	await bridge.setSupportedChain("BSC");
		// 	expect(await bridge.supportedChains("BSC")).to.be.true;

		// 	await bridge.removeSupportedChain("BSC");
		// 	expect(await bridge.supportedChains("BSC")).to.be.false;
		// });

		// it('Withdraw function', async() => {

		// 	var amount = ethers.utils.parseEther('10');
		// 	await bridge.setAllowedToken(ethers.constants.AddressZero, "Ethereum");

		// 	const TokenLock = await ethers.getContractFactory("TokenMock");
		// 	var tokenLock = await TokenLock.deploy("TokenLock", "TL", amount, owner.address);
		// 	await bridge.setAllowedToken(tokenLock.address, "");

		// 	await bridge.setSupportedChain("Ala");
		// 	await expect(bridge.withdraw(tokenLock.address, ethers.utils.parseEther('0.03'))).to.revertedWith("Invalid token");

		// 	await bridge.lock(
		// 		ethers.constants.AddressZero,
		// 		"0x07B0C0f1EE1eC64A80293A1698Eb73C77E54Aae9",
		// 		0,
		// 		"Ala",
		// 		{value: ethers.utils.parseEther("10")})

		// 	await tokenLock.approve(bridge.address, amount);
		// 	await bridge.lock(
		// 		tokenLock.address,
		// 		"0x07B0C0f1EE1eC64A80293A1698Eb73C77E54Aae9",
		// 		amount,
		// 		"Ala");

		// 	await expect(bridge.withdraw(tokenLock.address, ethers.utils.parseEther('1'))).to.revertedWith("Incorrect amount");

	 //        // var balanceOwner = await ethers.provider.getBalance(owner.address)
	 //        await bridge.withdraw(tokenLock.address, ethers.utils.parseEther('0.03'));
	 //        await bridge.withdraw(ethers.constants.AddressZero, ethers.utils.parseEther('0.03'));

	 //        expect(await tokenLock.balanceOf(owner.address)).to.be.equal(ethers.utils.parseEther('0.03'));
	 //      });
		});
});
