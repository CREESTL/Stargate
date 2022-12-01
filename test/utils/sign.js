const { keccak256, defaultAbiCoder, toUtf8Bytes, solidityPack } = require("ethers/lib/utils");
const { ecsign } = require("ethereumjs-util");

/**
 * 
 * Order of calls (from higher level to lower)
 * 
 * 1) 			getSignatureFromDigest
 *                      |
 * 2) 			getPermitDigest
 *                  /       \
 * 3) getDomainSeparator + getPermitTypeHashNative
 */


// Generates the signature from permit digest
// permitDigest - Previously generated permit digest
// signer - A wallet with a private key
function getSignatureFromDigest(permitDigest, signer) {
	return ecsign(Buffer.from(permitDigest.slice(2), 'hex'), Buffer.from(signer.privateKey.slice(2), 'hex'));
}


// Generates the digest that is used in signature verification
// domainSeparator - The generated domain separator for the token
// typeHash - The generated type hash for the token
function getPermitDigest(domainSeparator, typeHash) {
	return keccak256(
		solidityPack(
			['bytes1', 'bytes1', 'bytes32', 'bytes32'],
			[
			'0x19',
			'0x01',
			domainSeparator,
			typeHash
			]
		)
	);
}


// Generates domain separator of the token
// tokenName - The name of the token to be transfered
// version - The version of domain separator
// chainId - The ID of the current chain
// verifyingAddress - The address of the contract that will verify the signature
function getDomainSeparator(version, chainId, verifyingAddress) {
	return keccak256(
		defaultAbiCoder.encode(
			['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
			[
			keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingAddress)')),
			keccak256(toUtf8Bytes('StargateBridge')),
			keccak256(toUtf8Bytes(version)),
			chainId,
			verifyingAddress,
			]
		)
	);
}

function getPermitTypeHash(receiver, amount, token, tokenId, chain, nonce) {
	return keccak256(
		defaultAbiCoder.encode(
			['bytes32', 'string', 'uint256', 'address', 'uint256', 'string', 'uint256'],
			[
				keccak256(toUtf8Bytes(
					"Permit(address receiver,uint256 amount,address token,uint256 tokenId,string chain,uint256 nonce)"
				)),
				receiver,
				amount,
				token,
				tokenId,
				chain,
				nonce,
			]
		)
	);
}

function getVerifyPriceTypeHash(stargateAmountForOneUsd, transferedTokensAmountForOneUsd, token, nonce) {
	return keccak256(
		defaultAbiCoder.encode(
			['bytes32', 'uint256', 'uint256', 'address', 'uint256'],
			[
			keccak256(toUtf8Bytes(
        "VerifyPrice(uint256 stargateAmountForOneUsd,uint256 transferedTokensAmountForOneUsd,address token,uint256 nonce)"
      )),
			stargateAmountForOneUsd,
			transferedTokensAmountForOneUsd,
			token,
      nonce
			]
		)
	);
}

module.exports = { 
	getSignatureFromDigest,
	getPermitDigest, 
	getDomainSeparator, 
	getPermitTypeHash,
	getVerifyPriceTypeHash
};
