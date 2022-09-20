// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IWrappedERC20.sol";
import "../interfaces/IWrappedERC721.sol";
import "../interfaces/IWrappedERC1155.sol";

library EIP712Utils {
    /// @dev Generates the digest that is used in signature verification for native tokens
    /// @param amount The amount of tokens to be transfered
    /// @param receiver The receiver of transfered tokens
    /// @param nonce Unique number to prevent replay
    function getPermitDigestNative(
        uint256 amount,
        address receiver,
        uint256 nonce
    ) internal view returns (bytes32) {
        bytes32 domainSeparator = getDomainSeparatorNative("1", block.chainid, address(this));
        bytes32 typeHash = getPermitTypeHashNative(amount, receiver, nonce);

        bytes32 permitDigest = keccak256(
            abi.encodePacked(
                uint16(0x1901),
                domainSeparator,
                typeHash
            )
        );

        return permitDigest;
    }

    /// @dev Generates domain separator of the native token
    /// @dev Used to generate permit digest afterwards
    /// @param version The version of separator
    /// @param chainId The ID of the current chain
    /// @param verifyingAddress The address of the contract that will verify the signature
    function getDomainSeparatorNative(
        string memory version,
        uint256 chainId, 
        address verifyingAddress
    ) internal pure returns (bytes32) {
            
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingAddress)"
                ),
                // NOTE This is a hardcoded name for any native token of the chain (ETH, MATIC, etc.)
                keccak256(bytes("Native")),
                // Version
                keccak256(bytes(version)),
                // ChainID
                chainId,
                // Verifying contract
                verifyingAddress
            ) 
        );   
    }

    /// @dev Generates the type hash for permit digest of native token
    /// @param amount The amount of tokens to be transfered
    /// @param receiver The receiver of transfered tokens
    /// @param nonce Unique number to prevent replay
    function getPermitTypeHashNative(
        uint256 amount,
        address receiver,
        uint256 nonce
    ) internal pure returns (bytes32) {

        bytes32 permitHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address receiver,uint256 amount,uint256 nonce)"
                ),
                receiver,
                amount,
                nonce
            )
        );

        return permitHash;
    }

    /// @dev Generates the digest that is used in signature verification for ERC20 tokens
    /// @param token The address of the token to be transfered
    /// @param amount The amount of tokens to be transfered
    /// @param receiver The receiver of transfered tokens
    /// @param nonce Unique number to prevent replay
    function getPermitDigestERC20(
        address token,
        uint256 amount,
        address receiver,
        uint256 nonce
    ) internal view returns (bytes32) {
        bytes32 domainSeparator = getDomainSeparatorERC20(token, "1", block.chainid, address(this));
        bytes32 typeHash = getPermitTypeHashERC20(amount, receiver, nonce);

        bytes32 permitDigest = keccak256(
            abi.encodePacked(
                uint16(0x1901),
                domainSeparator,
                typeHash
            )
        );

        return permitDigest;
    }

    /// @dev Generates domain separator of the ERC20 token
    /// @dev Used to generate permit digest afterwards
    /// @param token The address of the token to be transfered
    /// @param version The version of separator
    /// @param chainId The ID of the current chain
    /// @param verifyingAddress The address of the contract that will verify the signature
    function getDomainSeparatorERC20(
        address token,
        string memory version,
        uint256 chainId, 
        address verifyingAddress
    ) internal view returns (bytes32) {

        IWrappedERC20 ERC20token = IWrappedERC20(token);
        
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingAddress)"
                ),
                // Token name
                keccak256(bytes(ERC20token.name())),
                // Version
                keccak256(bytes(version)),
                // ChainID
                chainId,
                // Verifying contract
                verifyingAddress
            )
        );

    }

    /// @dev Generates the type hash for permit digest of ERC20 token
    /// @param amount The amount of tokens to be transfered
    /// @param receiver The receiver of transfered tokens
    /// @param nonce Unique number to prevent replay
    function getPermitTypeHashERC20(
        uint256 amount,
        address receiver,
        uint256 nonce
    ) internal pure returns (bytes32) {

        bytes32 permitHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address receiver,uint256 amount,uint256 nonce)"
                ),
                receiver,
                amount,
                nonce
            )
        );

        return permitHash;
    }

    /// @dev Generates the digest that is used in signature verification for ERC20 tokens
    /// @param token The address of the token to be transfered
    /// @param tokenId The ID of the transfered token
    /// @param receiver The receiver of transfered tokens
    /// @param nonce Unique number to prevent replay
    function getPermitDigestERC721(
        address token,
        uint256 tokenId,
        address receiver,
        uint256 nonce
    ) internal view returns (bytes32) {
        bytes32 domainSeparator = getDomainSeparatorERC721(token, "1", block.chainid, address(this));
        bytes32 typeHash = getPermitTypeHashERC721(tokenId, receiver, nonce);

        bytes32 permitDigest = keccak256(
            abi.encodePacked(
                uint16(0x1901),
                domainSeparator,
                typeHash
            )
        );

        return permitDigest;
    }

    /// @dev Generates domain separator of the ERC721 token
    /// @dev Used to generate permit digest afterwards
    /// @param token The address of the token to be transfered
    /// @param version The version of separator
    /// @param chainId The ID of the current chain
    /// @param verifyingAddress The address of the contract that will verify the signature
    function getDomainSeparatorERC721(
        address token,
        string memory version,
        uint256 chainId, 
        address verifyingAddress
    ) internal view returns (bytes32) {

        IWrappedERC721 ERC721token = IWrappedERC721(token);
        
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingAddress)"
                ),
                // Token name
                keccak256(bytes(ERC721token.name())),
                // Version
                keccak256(bytes(version)),
                // ChainID
                chainId,
                // Verifying contract
                verifyingAddress
            )
        );

    }

    /// @dev Generates the type hash for permit digest of ERC721 token
    /// @param tokenId The ID of transfered token
    /// @param receiver The receiver of transfered token
    /// @param nonce Unique number to prevent replay
    function getPermitTypeHashERC721(
        uint256 tokenId,
        address receiver,
        uint256 nonce
    ) internal pure returns (bytes32) {

        bytes32 permitHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address receiver,uint256 tokenId,uint256 nonce)"
                ),
                receiver,
                tokenId,
                nonce
            )
        );

        return permitHash;
    }

    /// @dev Generates the digest that is used in signature verification for ERC1155 tokens
    /// @param amount The amount of tokens of specific type
    /// @param token The address of transfered token
    /// @param tokenId The ID of the transfered token
    /// @param receiver The receiver of transfered tokens
    /// @param nonce Unique number to prevent replay
    function getPermitDigestERC1155(
        address token,
        uint256 tokenId,
        uint256 amount,
        address receiver,
        uint256 nonce
    ) internal view returns (bytes32) {
        bytes32 domainSeparator = getDomainSeparatorERC1155(token, tokenId, "1", block.chainid, address(this));
        bytes32 typeHash = getPermitTypeHashERC1155(tokenId, amount, receiver, nonce);

        bytes32 permitDigest = keccak256(
            abi.encodePacked(
                uint16(0x1901),
                domainSeparator,
                typeHash
            )
        );

        return permitDigest;
    }

    /// @dev Generates domain separator of the ERC1155 token
    /// @dev Used to generate permit digest afterwards
    /// @param token The address of the token to be transfered
    /// @param tokenId The ID of type of tokens
    /// @param version The version of separator
    /// @param chainId The ID of the current chain
    /// @param verifyingAddress The address of the contract that will verify the signature
    function getDomainSeparatorERC1155(
        address token,
        uint tokenId, 
        string memory version,
        uint256 chainId, 
        address verifyingAddress
    ) internal view returns (bytes32) {

        IWrappedERC1155 ERC1155token = IWrappedERC1155(token);
        
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string uri,string version,uint256 chainId,address verifyingAddress)"
                ),
                // Token uri
                keccak256(bytes(ERC1155token.uri(tokenId))),
                // Version
                keccak256(bytes(version)),
                // ChainID
                chainId,
                // Verifying contract
                verifyingAddress
            )
        );

    }

    /// @dev Generates the type hash for permit digest of ERC1155 token
    /// @param amount The amount of tokens of specific type
    /// @param tokenId The ID of type of tokens
    /// @param receiver The receiver of transfered token
    /// @param nonce Unique number to prevent replay
    function getPermitTypeHashERC1155(
        uint256 tokenId,
        uint256 amount,
        address receiver,
        uint256 nonce
    ) internal pure returns (bytes32) {

        bytes32 permitHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(uint256 tokenId,address receiver,uint256 amount,uint256 nonce)"
                ),
                tokenId,
                receiver,
                amount,
                nonce
            )
        );

        return permitHash;
    }
}
