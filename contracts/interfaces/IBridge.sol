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
    

    /// @notice Locks token on the source chain
    /// @param token Address of the token to lock
    /// @param amount The amount of tokens to lock
    /// @param targetChain The name of the target chain
    /// @return True if tokens were locked successfully
    function lock(
        address token,
        uint256 amount,
        string memory targetChain
    ) external payable returns(bool);

    /// @notice Burns tokens on a target chain
    /// @param token Address of the token to burn
    /// @param amount The amount of tokens to burn
    /// @param targetChain The name of the target chain
    /// @return True if tokens were burnt successfully
    function burn(
        address token,
        uint256 amount,
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

    /// @notice Unlocks tokens if the user is permitted to unlock
    /// @param token Address of the token to unlock
    /// @param amount The amount of tokens to unlock
    /// @param nonce Prevent replay attacks
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @return True if tokens were unlocked successfully
    function unlockWithPermit(
        address token,
        uint256 amount,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns(bool);

    // @notice Indicates that some tokens were locked in the source chain
    /// @param token Address of the token to lock
    /// @param sender The sender of the locking transaction
    /// @param amount The amount of tokens to lock
    /// @param targetChain The name of the target chain
    event Lock(
        address indexed token,
        address indexed sender,
        uint amount,
        string targetChain
    );

    /// @notice Indicates that some tokens were burnt in the target chain
    /// @param token Address of the token to burn
    /// @param sender The sender of the burning transaction
    /// @param amount The amount of tokens to burn
    /// @param targetChain The name of the source chain
    event Burn(
        address indexed token,
        address indexed sender,
        uint amount,
        string targetChain
    );

    /// @notice Indicates that some tokens were minted by permitted user
    /// @param token Address of the token to mint
    /// @param receiverAddress Address of the wallet in the target chain
    /// @param amount The amount of tokens to mint
    event MintWithPermit(
        address indexed token,
        address indexed receiverAddress,
        uint amount
    );

    /// @notice Indicates that some tokens were unlocked by permitted user
    /// @param token Address of the token to unlock
    /// @param receiverAddress Address of the wallet in the source chain
    /// @param amount The amount of tokens to unlock
    event UnlockWithPermit(
        address indexed token,
        address indexed receiverAddress,
        uint amount
    );

}
