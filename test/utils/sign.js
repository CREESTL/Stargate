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

//==========Native Tokens==========

// Generates the signature from permit digest
// permitDigest - Previously generated permit digest
// signer - A wallet with a private key
function getSignatureFromDigestNative(permitDigest, signer) {
	return ecsign(Buffer.from(permitDigest.slice(2), 'hex'), Buffer.from(signer.privateKey.slice(2), 'hex'));
}


// Generates the digest that is used in signature verification
// domainSeparator - The generated domain separator for the token
// typeHash - The generated type hash for the token
function getPermitDigestNative(domainSeparator, typeHash) {
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
function getDomainSeparatorNative(tokenName, version, chainId, verifyingAddress) {
	return keccak256(
		defaultAbiCoder.encode(
			['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
			[
			keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingAddress)')),
			keccak256(toUtf8Bytes(tokenName)),
			keccak256(toUtf8Bytes(version)),
			chainId,
			verifyingAddress,
			]
		)
	);
}

function getPermitTypeHashNative(receiver, amount, nonce) {
	return keccak256(
		defaultAbiCoder.encode(
			['bytes32', 'address', 'uint256', 'uint256'],
			[
			keccak256(toUtf8Bytes("Permit(address receiver,uint256 amount,uint256 nonce)")),
			receiver,
			amount,
			nonce,
			]
		)
	);
}


//==========ERC20 Tokens==========

// Generates the signature from permit digest
// permitDigest - Previously generated permit digest
// signer - A wallet with a private key
function getSignatureFromDigestERC20(permitDigest, signer) {
	return ecsign(Buffer.from(permitDigest.slice(2), 'hex'), Buffer.from(signer.privateKey.slice(2), 'hex'));
}


// Generates the digest that is used in signature verification
// domainSeparator - The generated domain separator for the token
// typeHash - The generated type hash for the token
function getPermitDigestERC20(domainSeparator, typeHash) {
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
function getDomainSeparatorERC20(tokenName, version, chainId, verifyingAddress) {
	return keccak256(
		defaultAbiCoder.encode(
			['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
			[
			keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingAddress)')),
			keccak256(toUtf8Bytes(tokenName)),
			keccak256(toUtf8Bytes(version)),
			chainId,
			verifyingAddress,
			]
		)
	);
}

function getPermitTypeHashERC20(receiver, amount, nonce) {
	return keccak256(
		defaultAbiCoder.encode(
			['bytes32', 'address', 'uint256', 'uint256'],
			[
			keccak256(toUtf8Bytes("Permit(address receiver,uint256 amount,uint256 nonce)")),
			receiver,
			amount,
			nonce,
			]
		)
	);
}

//==========ERC721 Tokens==========

// Generates the signature from permit digest
// permitDigest - Previously generated permit digest
// signer - A wallet with a private key
function getSignatureFromDigestERC721(permitDigest, signer) {
	return ecsign(Buffer.from(permitDigest.slice(2), 'hex'), Buffer.from(signer.privateKey.slice(2), 'hex'));
}


// Generates the digest that is used in signature verification
// domainSeparator - The generated domain separator for the token
// typeHash - The generated type hash for the token
function getPermitDigestERC721(domainSeparator, typeHash) {
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
function getDomainSeparatorERC721(tokenName, version, chainId, verifyingAddress) {
	return keccak256(
		defaultAbiCoder.encode(
			['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
			[
			keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingAddress)')),
			keccak256(toUtf8Bytes(tokenName)),
			keccak256(toUtf8Bytes(version)),
			chainId,
			verifyingAddress,
			]
		)
	);
}

function getPermitTypeHashERC721(receiver, tokenId, nonce) {
	return keccak256(
		defaultAbiCoder.encode(
			['bytes32', 'address', 'uint256', 'uint256'],
			[
			keccak256(toUtf8Bytes("Permit(address receiver,uint256 amount,uint256 nonce)")),
			receiver,
			tokenId,
			nonce,
			]
		)
	);
}


//==========ERC1155 Tokens==========

// Generates the signature from permit digest
// permitDigest - Previously generated permit digest
// signer - A wallet with a private key
function getSignatureFromDigestERC1155(permitDigest, signer) {
	return ecsign(Buffer.from(permitDigest.slice(2), 'hex'), Buffer.from(signer.privateKey.slice(2), 'hex'));
}


// Generates the digest that is used in signature verification
// domainSeparator - The generated domain separator for the token
// typeHash - The generated type hash for the token
function getPermitDigestERC1155(domainSeparator, typeHash) {
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
// tokenUri - The URI of the token to be transfered
// version - The version of domain separator
// chainId - The ID of the current chain
// verifyingAddress - The address of the contract that will verify the signature
function getDomainSeparatorERC1155(tokenUri, version, chainId, verifyingAddress) {
	return keccak256(
		defaultAbiCoder.encode(
			['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
			[
			keccak256(toUtf8Bytes('EIP712Domain(string uri,string version,uint256 chainId,address verifyingAddress)')),
			// NOTE Use token URI instead of amount here
			keccak256(toUtf8Bytes(tokenUri)),
			keccak256(toUtf8Bytes(version)),
			chainId,
			verifyingAddress,
			]
		)
	);
}

function getPermitTypeHashERC1155(receiver, tokenId, amount, nonce) {
	return keccak256(
		defaultAbiCoder.encode(
			['bytes32', 'uint256', 'address', 'uint256', 'uint256'],
			[
			keccak256(toUtf8Bytes("Permit(uint256 tokenId,address receiver,uint256 amount,uint256 nonce)")),
			tokenId,
			receiver,
			amount,
			nonce,
			]
		)
	);
}


module.exports = { 
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
};
