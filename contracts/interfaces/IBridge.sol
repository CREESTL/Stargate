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
    /// @param receiver The receiver of wrapped tokens
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

    /// @notice Locks ERC 721 token on the source chain
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

    /// @notice Burns tokens on a target chain
    /// @param token Address of the token to burn
    /// @param amount The amount of tokens to burn
    /// @param receiver The receiver of unlocked tokens
    /// @param targetChain The name of the target chain
    /// @return True if tokens were burnt successfully
    function burn(
        address token,
        uint256 amount,
        string memory receiver,
        string memory targetChain
    ) external returns(bool);

    /// @notice Mints tokens if the user is permitted to mint
    /// @param token Address of the token to mint
    /// @param amount The amount of tokens to mint
    /// @param nonce Prevent replay attacks
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @return True if tokens were minted successfully
    function mintWithPermit(
        address token,
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
    /// @param token Address of the token to unlock
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
    /// @param token Address of the token to unlock
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
    /// @param tokenId ID of the token to lock
    /// @param sender The sender of the locking transaction
    /// @param receiver The receiver of wrapped tokens
    /// @param targetChain The name of the target chain
    event LockERC721(
        uint256 indexed tokenId,
        address indexed sender,
        string indexed receiver,
        string targetChain
    );


    /// @notice Indicates that ERC1155 tokens were locked in the source chain
    /// @param tokenId ID of the type of tokens
    /// @param amount The amount of tokens of specific type
    /// @param sender The sender of the locking transaction
    /// @param receiver The receiver of wrapped tokens
    /// @param targetChain The name of the target chain
    event LockERC1155(
        uint256 indexed tokenId,
        uint256 amount,
        address indexed sender,
        string indexed receiver,
        string targetChain
    );

    /// @notice Indicates that some tokens were burnt in the target chain
    /// @param token Address of the token to burn
    /// @param sender The sender of the burning transaction
    /// @param receiver The receiver of unlocked tokens
    /// @param amount The amount of tokens to burn
    /// @param targetChain The name of the source chain
    event Burn(
        address indexed token,
        address indexed sender,
        string indexed receiver,
        uint256 amount,
        string targetChain
    );

    /// @notice Indicates that some tokens were minted by permitted user
    /// @param token Address of the token to mint
    /// @param receiver Address of the wallet in the target chain
    /// @param amount The amount of tokens to mint
    event MintWithPermit(
        address indexed token,
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
    /// @param tokenId ID of unlocked token
    /// @param receiver Address of the wallet in the source chain
    event UnlockWithPermitERC721(
        uint256 indexed tokenId,
        address indexed receiver
    );

    /// @notice Indicates that ERC1155 tokens were unlocked by permitted user
    /// @param tokenId ID of type of tokens
    /// @param amount The amount of tokens to unlock
    /// @param receiver Address of the wallet in the source chain
    event UnlockWithPermitERC1155(
        uint256 indexed tokenId,
        address indexed amount,
        address receiver
    );

    /// @notice Indicates that fees were withdrawn
    /// @param token The address of the token (zero address for native token)
    /// @param receiver Address of the wallet in the source chain
    /// @param amount The amount of fees from a single token to be withdrawn
    event Withdraw(
        address indexed token,
        address indexed receiver,
        uint256 amount
    );

}
