// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/// @title An interface for a bridge contract
/// @dev Declares default methods of a bridge contract
interface IBridge {

    /**
     * In case if tokens were transfered from chainA to chainB
     * chainA is the source chain
     * chainB is the target chain
     * If case if then tokens were transfered back from chainB to chainA
     * chainA is still the source chain
     * chainB is still the target chain
     * (in comments below)
     */

    /// @notice Locks native tokens on the source chain
    /// @param amount The amount of tokens to lock
    /// @param receiver The wrapped of wrapped tokens
    /// @param targetChain The name of the target chain
    /// @return True if tokens were locked successfully
    function lockNative(
        uint256 amount,
        string memory receiver,
        string memory targetChain
    ) external payable returns(bool);

    /// @notice Locks ERC20 tokens on the source chain
    /// @param token Address of the token to lock
    /// @param amount The amount of tokens to lock
    /// @param receiver The receiver of wrapped tokens
    /// @param targetChain The name of the target chain
    /// @return True if tokens were locked successfully
    function lockERC20(
        address token,
        uint256 amount,
        string memory receiver,
        string memory targetChain
    ) external payable returns(bool);

    /// @notice Locks ERC721 token on the source chain
    /// @param token The address of the token to lock
    /// @param tokenId The ID of the token to lock
    /// @param receiver The receiver of wrapped tokens
    /// @param targetChain The name of the target chain
    /// @return True if tokens were locked successfully
    function lockERC721(
        address token,
        uint256 tokenId,
        string memory receiver,
        string memory targetChain
    ) external payable returns(bool);

    /// @notice Locks ERC1155 token on the source chain
    /// @param token The address of the token to lock
    /// @param tokenId The ID of token type
    /// @param amount The amount of tokens of specifi type
    /// @param receiver The receiver of wrapped tokens
    /// @param targetChain The name of the target chain
    /// @return True if tokens were locked successfully
    function lockERC1155(
        address token,
        uint256 tokenId,
        uint amount,
        string memory receiver,
        string memory targetChain
    ) external payable returns(bool);

    /// @notice Burns ERC20 tokens on a target chain
    /// @param token The address of the token to burn
    /// @param amount The amount of tokens to burn
    /// @param receiver The receiver of unlocked tokens on the original chain (not only EVM)
    /// @param targetChain The name of the target chain
    /// @return True if tokens were burnt successfully
    function burnERC20(
        address token,
        uint256 amount,
        string memory receiver,
        string memory targetChain
    ) external payable returns(bool);


    /// @notice Burns ERC721 tokens on a target chain
    /// @param token The address of the token to burn 
    /// @param tokenId The ID of the token to lock
    /// @param receiver The receiver of unlocked tokens on the original chain (not only EVM)
    /// @param targetChain The name of the target chain
    /// @return True if tokens were burnt successfully
    function burnERC721(
        address token,
        uint256 tokenId,
        string memory receiver,
        string memory targetChain
    ) external payable returns(bool);

    /// @notice Burns ERC1155 tokens on a target chain
    /// @param token The address of the token to burn
    /// @param tokenId The ID of the token to lock
    /// @param amount The amount of tokens of specific type
    /// @param receiver The receiver of unlocked tokens on the original chain (not only EVM)
    /// @param targetChain The name of the target chain
    /// @return True if tokens were burnt successfully
    function burnERC1155(
        address token,
        uint256 tokenId,
        uint256 amount,
        string memory receiver,
        string memory targetChain
    ) external payable returns(bool);


    /// @notice Mints ERC20 tokens if the user is permitted to do so
    /// @param token The address of the token to mint
    /// @param amount The amount of tokens to mint
    /// @param nonce Prevent replay attacks
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @return True if tokens were minted successfully
    function mintWithPermitERC20(
        address token,
        uint256 amount,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns(bool);


    /// @notice Mints ERC721 tokens if the user is permitted to do so
    /// @param token The address of the token to mint
    /// @param tokenId The ID of token to mint
    /// @param nonce Prevent replay attacks
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @return True if tokens were minted successfully
    function mintWithPermitERC721(
        address token,
        uint256 tokenId,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns(bool);


    /// @notice Mints ERC1155 tokens if the user is permitted to do so
    /// @param token The address of the token to mint
    /// @param tokenId The ID of type of tokens
    /// @param amount The amount of tokens of specific type
    /// @param nonce Prevent replay attacks
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @return True if tokens were minted successfully
    function mintWithPermitERC1155(
        address token,
        uint256 tokenId,
        uint256 amount, 
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns(bool);


    /// @notice Unlocks native tokens if the user is permitted to unlock
    /// @param amount The amount of tokens to unlock
    /// @param nonce Prevent replay attacks
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @return True if tokens were unlocked successfully
    function unlockWithPermitNative(
        uint256 amount,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns(bool);
    
    /// @notice Unlocks ERC20 tokens if the user is permitted to unlock
    /// @param token The address of the token to unlock
    /// @param amount The amount of tokens to unlock
    /// @param nonce Prevent replay attacks
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @return True if tokens were unlocked successfully
    function unlockWithPermitERC20(
        address token,
        uint256 amount,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns(bool);

    /// @notice Unlocks ERC721 tokens if the user is permitted to unlock
    /// @param token The address of the token to unlock
    /// @param tokenId The ID of token to unlock
    /// @param nonce Prevent replay attacks
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @return True if tokens were unlocked successfully
    function unlockWithPermitERC721(
        address token,
        uint256 tokenId,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns(bool);

    /// @notice Unlocks ERC1155 tokens if the user is permitted to unlock
    /// @param token Address of the token to unlock
    /// @param tokenId The ID of token type
    /// @param amount The amount of tokens of the type
    /// @param nonce Prevent replay attacks
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @return True if tokens were unlocked successfully
    function unlockWithPermitERC1155(
        address token,
        uint256 tokenId,
        uint256 amount,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns(bool);

    /// @notice Indicates that native tokens were locked in the source chain
    /// @param sender The sender of the locking transaction
    /// @param receiver The receiver of wrapped tokens
    /// @param amount The amount of tokens to lock
    /// @param targetChain The name of the target chain
    event LockNative(
        address indexed sender,
        string indexed receiver,
        uint256 amount,
        string targetChain
    );

    /// @notice Indicates that ERC20 tokens were locked in the source chain
    /// @param token Address of the token to lock
    /// @param sender The sender of the locking transaction
    /// @param receiver The receiver of wrapped tokens
    /// @param amount The amount of tokens to lock
    /// @param targetChain The name of the target chain
    event LockERC20(
        address indexed token,
        address indexed sender,
        string indexed receiver,
        uint256 amount,
        string targetChain
    );

    /// @notice Indicates that ERC721 tokens were locked in the source chain
    /// @param token The address of token to lock
    /// @param tokenId The ID of the token to lock
    /// @param sender The sender of the locking transaction
    /// @param receiver The receiver of wrapped tokens
    /// @param targetChain The name of the target chain
    event LockERC721(
        address indexed token,
        uint256 indexed tokenId,
        address indexed sender,
        string receiver,
        string targetChain
    );


    /// @notice Indicates that ERC1155 tokens were locked in the source chain
    /// @param token The address of token to lock
    /// @param tokenId The ID of the type of tokens
    /// @param amount The amount of tokens of specific type
    /// @param sender The sender of the locking transaction
    /// @param receiver The receiver of wrapped tokens
    /// @param targetChain The name of the target chain
    event LockERC1155(
        address indexed token,
        uint256 indexed tokenId,
        address indexed sender,
        string receiver,
        uint256 amount,
        string targetChain
    );

    /// @notice Indicates that ERC20 tokens were burnt in the target chain
    /// @param token The address of the token to burn
    /// @param sender The sender of the burning transaction
    /// @param receiver The receiver of unlocked tokens
    /// @param amount The amount of tokens to burn
    /// @param targetChain The name of the source chain
    event BurnERC20(
        address indexed token,
        address indexed sender,
        string indexed receiver,
        uint256 amount,
        string targetChain
    );

    /// @notice Indicates that ERC721 tokens were burnt in the target chain
    /// @param token The address of the token to burn
    /// @param tokenId The ID of transfered token
    /// @param sender The sender of the burning transaction
    /// @param receiver The receiver of unlocked tokens
    /// @param targetChain The name of the source chain
    event BurnERC721(
        address indexed token,
        uint256 indexed tokenId,
        address indexed sender,
        string receiver,
        string targetChain
    );

    /// @notice Indicates that ERC1155 tokens were burnt in the target chain
    /// @param token The address of the token to burn
    /// @param tokenId The ID of transfered token
    /// @param sender The sender of the burning transaction
    /// @param receiver The receiver of unlocked tokens
    /// @param amount The amount of tokens to burn
    /// @param targetChain The name of the source chain
    event BurnERC1155(
        address indexed token,
        uint256 indexed tokenId,
        address indexed sender,
        string receiver,
        uint256 amount,
        string targetChain
    );


    /// @notice Indicates that ERC20 tokens were minted by permitted user
    /// @param token The address of the token to mint
    /// @param receiver Address of the wallet in the target chain
    /// @param amount The amount of tokens to mint
    event MintWithPermitERC20(
        address indexed token,
        address indexed receiver,
        uint256 amount
    );

    /// @notice Indicates that ERC721 tokens were minted by permitted user
    /// @param token The address of the token to mint
    /// @param tokenId The ID of transfered token
    /// @param receiver Address of the wallet in the target chain
    event MintWithPermitERC721(
        address indexed token,
        uint256 indexed tokenId,
        address indexed receiver
    );

    /// @notice Indicates that ERC1155 tokens were minted by permitted user
    /// @param token The address of the token to mint
    /// @param tokenId The ID of transfered token
    /// @param receiver Address of the wallet in the target chain
    /// @param amount The amount of tokens of specific type
    event MintWithPermitERC1155(
        address indexed token,
        uint256 indexed tokenId,
        address indexed receiver,
        uint256 amount
    );

    /// @notice Indicates that native tokens were unlocked by permitted user
    /// @param receiver Address of the wallet in the source chain
    /// @param amount The amount of tokens to unlock
    event UnlockWithPermitNative(
        address indexed receiver,
        uint256 amount
    );

    /// @notice Indicates that ERC20 tokens were unlocked by permitted user
    /// @param token Address of the token to unlock
    /// @param receiver Address of the wallet in the source chain
    /// @param amount The amount of tokens to unlock
    event UnlockWithPermitERC20(
        address indexed token,
        address indexed receiver,
        uint256 amount
    );

    /// @notice Indicates that ERC721 tokens were unlocked by permitted user
    /// @param token The address of token to unlock
    /// @param tokenId ID of unlocked token
    /// @param receiver Address of the wallet in the source chain
    event UnlockWithPermitERC721(
        address indexed token, 
        uint256 indexed tokenId,
        address indexed receiver
    );

    /// @notice Indicates that ERC1155 tokens were unlocked by permitted user
    /// @param token The address of token to unlock
    /// @param tokenId ID of type of tokens
    /// @param amount The amount of tokens to unlock
    /// @param receiver Address of the wallet in the source chain
    event UnlockWithPermitERC1155(
        address indexed token,
        uint256 indexed tokenId,
        address indexed receiver,
        uint256 amount
    );

    /// @notice Indicates that token fees were withdrawn
    /// @param receiver Address of the wallet in the source chain
    /// @param amount The amount of fees from a single token to be withdrawn
    event Withdraw(
        address indexed receiver,
        uint256 amount
    );

}
