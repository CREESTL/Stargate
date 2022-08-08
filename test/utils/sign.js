const { keccak256, defaultAbiCoder, toUtf8Bytes, solidityPack } = require("ethers/lib/utils");
const { ecsign } = require("ethereumjs-util");

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

function getPermitDigest(domainSeparator, accountAddress, amount, nonce) {
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
                            accountAddress,
                            amount,
                            nonce,
                        ]
                    )
                ),
            ]
        )
    );
}

function getSignature(domainSeparator, accountAddress, amount, nonce, signer) {
    const permitDigest = getPermitDigest(domainSeparator, accountAddress, amount, nonce);

    return ecsign(Buffer.from(permitDigest.slice(2), 'hex'), Buffer.from(signer.privateKey.slice(2), 'hex'));
}

function getSignatureWithPermit(permitDigest, signer) {
    return ecsign(Buffer.from(permitDigest.slice(2), 'hex'), Buffer.from(signer.privateKey.slice(2), 'hex'));
}

module.exports = { getDomainSeparator, getPermitDigest, getSignature, getSignatureWithPermit };
