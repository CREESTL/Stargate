const { keccak256, defaultAbiCoder, toUtf8Bytes, solidityPack } = require("ethers/lib/utils");
const { ecsign } = require("ethereumjs-util");

/**
 * 
 * Order of calls
 * 
 * 1) getDomainSeparator
 * 2) getPermitDigest
 * 3) getSignatureFromDigest
 */

// Generates domain separator of the token
// tokenName - The name of the token to be transfered
// version - The version of domain separator
// chainId - The ID of the current chain
// approveAddress - The address of the contract that will verify the signature
function getDomainSeparator(tokenName, version, chainId, approveAddress) {
	return keccak256(
		defaultAbiCoder.encode(
			['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
			[
			keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
			keccak256(toUtf8Bytes(tokenName)),
			keccak256(toUtf8Bytes(version)),
			chainId,
			approveAddress,
			]
			)
		);
}
 
// Generates the digest that is used in signature verification
// domainSeparator - The generated domain separator for the token
// receiver - The receiver of transfered tokens
// amount - The amount of tokens to be transfered
// nonce - A unique number to prevent replay attacks
function getPermitDigest(domainSeparator, receiver, amount, nonce) {
	return keccak256(
		solidityPack(
			['bytes1', 'bytes1', 'bytes32', 'bytes32'],
			[
			'0x19',
			'0x01',
			domainSeparator,
			keccak256(
				defaultAbiCoder.encode(
					['bytes32', 'address', 'uint256', 'uint256'],
					[
					keccak256(toUtf8Bytes("Permit(address spender,uint256 value,uint256 nonce)")),
					receiver,
					amount,
					nonce,
					]
					)
				),
			]
			)
		);
}

// Generates the signature from permit digest
// permitDigest - Previously generated permit digest
// signer - A wallet with a private key
function getSignatureFromDigest(permitDigest, signer) {
	return ecsign(Buffer.from(permitDigest.slice(2), 'hex'), Buffer.from(signer.privateKey.slice(2), 'hex'));
}

module.exports = { getDomainSeparator, getPermitDigest, getSignatureFromDigest };
