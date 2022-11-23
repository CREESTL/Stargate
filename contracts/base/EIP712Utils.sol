// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IBridge.sol";

abstract contract EIP712Utils is IBridge {
    bytes32 constant PERMIT_TYPEHASH = keccak256(
        "Permit(address receiver,uint256 amount,address token,uint256 tokenId,string chain,uint256 nonce)"
    );
    bytes32 constant VERIFYPRICE_TYPEHASH = keccak256(
        "VerifyPrice(uint256 stargateAmountForOneUsd,uint256 transferedTokensAmountForOneUsd,address token,uint256 nonce)"
    );
    /// @dev Generates the digest that is used in signature verification
    /// @param params BridgeParams structure (see definition in IBridge.sol)
    /// @param verifyPrice used in lock/burn functions to verify token prices, otherwise "false"
    /// @param chain If not price verification (unlock or mint) we check chain
    function getPermitDigest(
        BridgeParams calldata params,
        bool verifyPrice,
        string memory chain
    ) public view returns (bytes32) {
        bytes32 domainSeparator = getDomainSeparator("1", block.chainid, address(this));
        bytes32 typeHash = getPermitTypeHash(params, verifyPrice, chain);

        bytes32 permitDigest = keccak256(
            abi.encodePacked(
                uint16(0x1901),
                domainSeparator,
                typeHash
            )
        );
        return permitDigest;
    }

    /// @dev Generates domain separator
    /// @dev Used to generate permit digest afterwards
    /// @param version The version of separator
    /// @param chainId The ID of the current chain
    /// @param verifyingAddress The address of the contract that will verify the signature
    function getDomainSeparator(
        string memory version,
        uint256 chainId, 
        address verifyingAddress
    ) internal pure returns (bytes32) {
            
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingAddress)"
                ),
                keccak256(bytes("StargateBridge")),
                // Version
                keccak256(bytes(version)),
                // ChainID
                chainId,
                // Verifying contract
                verifyingAddress
            ) 
        );   
    }

    /// @dev Generates the type hash for permit digest
    /// @param params BridgeParams structure (see definition in IBridge.sol)
    /// @param verifyPrice used in lock/burn functions to verify token prices, otherwise "false"
    /// @param chain If not price verification (unlock or mint) we check chain
    function getPermitTypeHash(
        BridgeParams calldata params,
        bool verifyPrice,
        string memory chain
    ) internal pure returns (bytes32) {
        bytes32 permitHash;
        if(verifyPrice) {
            permitHash = keccak256(
                abi.encode(
                    VERIFYPRICE_TYPEHASH,
                    params.stargateAmountForOneUsd,
                    params.transferedTokensAmountForOneUsd,
                    params.token,
                    params.nonce
                )
            );
        } else{
            permitHash = keccak256(
                abi.encode(
                    PERMIT_TYPEHASH,
                    params.receiver,
                    params.amount,
                    params.token,
                    params.tokenId,
                    chain,
                    params.nonce
                )
            );
        }
        return permitHash;
    }
}

