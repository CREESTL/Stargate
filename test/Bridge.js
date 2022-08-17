const { BigNumber, bigNumberify } = require("ethers");
const { ethers } = require("hardhat");
const hre = require("hardhat");
const { expect } = require("chai");
const { solidity, createFixtureLoader} = require('ethereum-waffle');

const { getDomainSeparator, getPermitDigest, getSignatureWithPermit } = require("./utils/sign");
const {boolean} = require("hardhat/internal/core/params/argumentTypes");

describe('Bridge', () => {
    var bridge;
    var tokenStandart;
    var factoryToken;
    // var provider;
    let loadFixture;
    // var chainId = 31337;
    var chainId = 1;

    const mnemonic = "announce room limb pattern dry unit scale effort smooth jazz weasel alcohol";
    const bot_messenger = ethers.Wallet.fromMnemonic(mnemonic);

    beforeEach(async () => {
        // provider = ethers.getDefaultProvider();
        [owner, client, fee] = await ethers.getSigners();
        const WrappedERC20Template = await ethers.getContractFactory("WrappedERC20Template");
        const WrappedERC20Template = await ethers.getContractFactory("WrappedERC20Template");
        const Bridge = await ethers.getContractFactory("Bridge");

        tokenStandart = await WrappedERC20Template.deploy();
        bridge = await Bridge.deploy(tokenStandart.address, bot_messenger.address, 3);
        factoryToken = await WrappedERC20Template.deploy(tokenStandart.address, bridge.address);
        // loadFixture = createFixtureLoader(
        //     await ethers.getSigners(),
        //     provider
        // );

        });
    describe("Bridge main (lock/unlock/burn/mint) functions", function () {
        it('lock eth', async() => {

            let amount = ethers.utils.parseEther('100');

            await bridge.setAllowedToken(ethers.constants.AddressZero, "Ethereum");
            //await bridge.setSupportedChain("Ala");

             expect(await bridge.lock(ethers.constants.AddressZero, "0x07B0C0f1EE1eC64A80293A1698Eb73C77E54Aae9", 0, "Ala", {value: ethers.utils.parseEther("10")}))
                .to.emit(bridge, "Lock")
                 .withArgs(ethers.constants.AddressZero, client.address, "0x07B0C0f1EE1eC64A80293A1698Eb73C77E54Aae9", amount, "Ala");

        });
        it('burn token', async() => {
            await factoryToken.connect(owner).createNewToken("TestToken1", "TT1", 8);
            [address1] = await factoryToken.getAllowedTokens();
            token1 = await ethers.getContractAt('IWrappedERC20Template', address1);
            let amount = ethers.utils.parseEther('1000');
            let amountWithoutFee = ethers.utils.parseEther('997');
            //chainId = 1 for Ethereum mainnet
            DOMAIN_SEPARATOR = getDomainSeparator((await token1.name()), '1', chainId, bridge.address);
            const permitDigest = getPermitDigest(DOMAIN_SEPARATOR, client.address, amount, 0);
            let sign = getSignatureWithPermit(permitDigest, bot_messenger);

            await bridge.setAllowedToken(token1.address, "");
            await bridge.setSupportedChain("Ala");

            await bridge.connect(client).mintWithPermit(token1.address, amount, 0, sign.v, sign.r, sign.s);

            await token1.connect(client).approve(bridge.address, amount);
            await expect(bridge.connect(client).burn(token1.address, "0x07B0C0f1EE1eC64A80293A1698Eb73C77E54Aae9", amount, "BSC"))
                .to.revertedWith("Not supported");

            await expect(bridge.connect(client).burn(token1.address, "0x07B0C0f1EE1eC64A80293A1698Eb73C77E54Aae9", amount, "Ala"))
                .to.emit(bridge, "Burn").withArgs(token1.address, client.address, "0x07B0C0f1EE1eC64A80293A1698Eb73C77E54Aae9", amountWithoutFee, "Ala");
        });
        it('mintWithPermit function', async() => {
            await factoryToken.createNewToken("TestToken1", "TT1", 8);
            [address1] = await factoryToken.getAllowedTokens();
            token1 = await ethers.getContractAt('IWrappedERC20Template', address1);

            DOMAIN_SEPARATOR = getDomainSeparator((await token1.name()), '1', chainId, bridge.address);
            const permitDigest = getPermitDigest(DOMAIN_SEPARATOR, client.address, ethers.utils.parseEther('1000'), 0);
            let sign = getSignatureWithPermit(permitDigest, bot_messenger);

            await bridge.setAllowedToken(address1, "");

            await expect(bridge.connect(client).mintWithPermit(
                token1.address,
                ethers.utils.parseEther('2000'),
                0,
                sign.v,
                sign.r,
                sign.s)).to.revertedWith("Invalid signature");

            await expect(bridge.connect(owner).mintWithPermit(
                token1.address,
                ethers.utils.parseEther('1000'),
                0,
                sign.v,
                sign.r,
                sign.s)).to.revertedWith("Invalid signature");

            expect(await bridge.connect(client).mintWithPermit(
                token1.address,
                ethers.utils.parseEther('1000'),
                0,
                sign.v,
                sign.r,
                sign.s
            )).to.emit(bridge, "MintWithPermit").withArgs(token1.address, client.address, ethers.utils.parseEther('1000'));

            await expect(bridge.connect(client).mintWithPermit(
                token1.address,
                ethers.utils.parseEther('1000'),
                0,
                sign.v,
                sign.r,
                sign.s)).to.revertedWith("Request already processed");


            expect(await token1.balanceOf(client.address)).to.be.equal(ethers.utils.parseEther('1000'));
        });
        it('unlockWithPermit token function', async() => {

            const amount = ethers.utils.parseEther('100');
            const TokenLock = await ethers.getContractFactory("TokenMock");
            var tokenLock = await TokenLock.deploy("TokenLock", "TL", amount, bridge.address);

            DOMAIN_SEPARATOR = getDomainSeparator((await tokenLock.name()), '1', chainId, bridge.address);
            const permitDigest = getPermitDigest(DOMAIN_SEPARATOR, client.address, amount, 0);
            let sign = getSignatureWithPermit(permitDigest, bot_messenger);

            await bridge.setAllowedToken(tokenLock.address, "");
            expect(await bridge.connect(client).unlockWithPermit(
                tokenLock.address,
                amount,
                0,
                sign.v,
                sign.r,
                sign.s)).to.emit(bridge, "UnlockWithPermit")
                .withArgs(tokenLock.address, client.address, amount);

            await expect(bridge.connect(client).unlockWithPermit(
                tokenLock.address,
                amount,
                0,
                sign.v,
                sign.r,
                sign.s)).to.revertedWith("Request already processed");
        });

        it('unlockWithPermit ETH function', async() => {
            const amount = ethers.utils.parseEther('1');
            const amountUnlock = ethers.utils.parseEther('0.5');
            await bridge.setAllowedToken(ethers.constants.AddressZero, "Ethereum");
            await bridge.setSupportedChain("Ala");
            await bridge.connect(client).lock(ethers.constants.AddressZero, "0x07B0C0f1EE1eC64A80293A1698Eb73C77E54Aae9", 0, "Ala", {value: ethers.utils.parseEther("10")});

            DOMAIN_SEPARATOR = getDomainSeparator("Ethereum", '1', chainId, bridge.address);
            const permitDigest = getPermitDigest(DOMAIN_SEPARATOR, client.address, amountUnlock, 0);
            let sign = getSignatureWithPermit(permitDigest, bot_messenger);

            expect(await bridge.connect(client).unlockWithPermit(
                ethers.constants.AddressZero,
                amountUnlock,
                0,
                sign.v,
                sign.r,
                sign.s)).to.emit(bridge, "UnlockWithPermit")
                .withArgs(ethers.constants.AddressZeroaddress, client.address, amountUnlock);

            await expect(bridge.connect(client).unlockWithPermit(
                ethers.constants.AddressZero,
                amount,
                0,
                sign.v,
                sign.r,
                sign.s)).to.revertedWith("Request already processed");

            await expect(bridge.connect(owner).mintWithPermit(
                ethers.constants.AddressZero,
                amount,
                0,
                sign.v,
                sign.r,
                sign.s)).to.revertedWith("Invalid signature");
        });
    });
    describe("Bridge other functions", function () {
        it('setBridgedStandardERC20 function', async() => {
            const WrappedERC20TemplateOther = await ethers.getContractFactory("WrappedERC20Template");
            const WrappedERC20TemplateOther = await ethers.getContractFactory("WrappedERC20Template");
            tokenStandart2 = await WrappedERC20TemplateOther.deploy();
            factoryToken2 = await WrappedERC20TemplateOther.deploy(tokenStandart2.address, bridge.address);

            expect(await bridge.bridgeStandardERC20()).to.be.equal(tokenStandart.address);
            await bridge.setBridgedStandardERC20(tokenStandart2.address);
            expect(await bridge.bridgeStandardERC20()).to.be.equal(tokenStandart2.address);

            await expect(bridge.connect(client).setBridgedStandardERC20(tokenStandart2.address))
                .to.revertedWith("onlyAdmin");
            await expect(bridge.setBridgedStandardERC20(ethers.constants.AddressZero))
                .to.revertedWith("The address is null");

        });
        it('allowedToken function', async() => {
            const TokenLock = await ethers.getContractFactory("TokenMock");
            var tokenLock = await TokenLock.deploy("TokenLock", "TL", 100000, bridge.address);
            DOMAIN_SEPARATOR = getDomainSeparator((await tokenLock.name()), '1', chainId, bridge.address);
            DOMAIN_SEPARATOR_ETH = getDomainSeparator(("Ethereum"), '1', chainId, bridge.address);
            console.log(hre.network.config.chainId);
            await bridge.setAllowedToken(tokenLock.address, "");

            await expect(bridge.connect(client).setAllowedToken(tokenLock.address, ""))
                .to.revertedWith("onlyAdmin");

            expect(await bridge.allowedTokens(tokenLock.address)).to.be.equal(DOMAIN_SEPARATOR);

            await bridge.setAllowedToken(ethers.constants.AddressZero, "Ethereum");
            expect(await bridge.allowedTokens(ethers.constants.AddressZero))
                .to.be.equal(DOMAIN_SEPARATOR_ETH);

            await expect(bridge.setAllowedToken(ethers.constants.AddressZero, ""))
                .to.revertedWith("Name is empty");

            await bridge.removeAllowedToken(tokenLock.address);
            expect(await bridge.allowedTokens(tokenLock.address))
                .to.be.equal(ethers.utils.hexZeroPad(ethers.utils.hexlify(0), 32));
        });

        it('setFeeRate function', async() => {
            await expect(bridge.connect(client).setFeeRate(10)).to.revertedWith("onlyAdmin");
            await expect(bridge.setFeeRate(1000000)).to.revertedWith("Out of range");
            await expect(bridge.setFeeRate(0)).to.revertedWith("Out of range");

            await bridge.setFeeRate(100);
            expect(await bridge.feeRate()).to.be.equal(100);
        });

        it('SupportedChain function', async() => {
            await expect(bridge.connect(client).setSupportedChain("BSC")).to.revertedWith("onlyAdmin");

            expect(await bridge.supportedChains("BSC")).to.be.false;
            await bridge.setSupportedChain("BSC");
            expect(await bridge.supportedChains("BSC")).to.be.true;

            await bridge.removeSupportedChain("BSC");
            expect(await bridge.supportedChains("BSC")).to.be.false;
        });

        it('Withdraw function', async() => {

            var amount = ethers.utils.parseEther('10');
            await bridge.setAllowedToken(ethers.constants.AddressZero, "Ethereum");

            const TokenLock = await ethers.getContractFactory("TokenMock");
            var tokenLock = await TokenLock.deploy("TokenLock", "TL", amount, owner.address);
            await bridge.setAllowedToken(tokenLock.address, "");

            await bridge.setSupportedChain("Ala");
            await expect(bridge.withdraw(tokenLock.address, ethers.utils.parseEther('0.03'))).to.revertedWith("Invalid token");

            await bridge.lock(
                ethers.constants.AddressZero,
                "0x07B0C0f1EE1eC64A80293A1698Eb73C77E54Aae9",
                0,
                "Ala",
                {value: ethers.utils.parseEther("10")})

            await tokenLock.approve(bridge.address, amount);
            await bridge.lock(
                tokenLock.address,
                "0x07B0C0f1EE1eC64A80293A1698Eb73C77E54Aae9",
                amount,
                "Ala");

            await expect(bridge.withdraw(tokenLock.address, ethers.utils.parseEther('1'))).to.revertedWith("Incorrect amount");

            // var balanceOwner = await ethers.provider.getBalance(owner.address)
            await bridge.withdraw(tokenLock.address, ethers.utils.parseEther('0.03'));
            await bridge.withdraw(ethers.constants.AddressZero, ethers.utils.parseEther('0.03'));

            expect(await tokenLock.balanceOf(owner.address)).to.be.equal(ethers.utils.parseEther('0.03'));
        });
    });
});
