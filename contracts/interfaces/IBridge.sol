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
    

    // TODO finish
    /// @notice Locks token on the source chain
    /// @param token Address of the token to lock
    /// @param to Address of the wallet in the target chain
    /// @param amount The amount of tokens to lock
    /// @param direction The name of the target chain
    /// @return True if tokens were locked successfuly
    function lock(
        address _token,
        string memory _to,
        uint256 _amount,
        string memory _direction
    ) external payable returns(bool);

    // TODO finish
    /// @notice Burns tokens on a target chain
    /// @param token Address of the token to burn
    /// @param to Address of the wallet in the source chain
    /// @param amount The amount of tokens to burn
    /// @param direction The name of the target chain
    /// @return True if tokens were burnt successfuly
    function burn(
        address _token,
        string memory _to,
        uint256 _amount,
        string memory _direction
    ) external returns(bool);

    /// @notice Mints tokens if the user is permitted to mint
    /// @param _token Address of the token to mint
    /// @param _amount The amount of tokens to mint
    /// @param _nonce Prevent replay attacks
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @return True if tokens were minted successfuly
    function mintWithPermit(
        address _token,
        uint256 _amount,
        uint256 _nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns(bool);

    /// @notice Locks tokens if the user is permitted to unlock
    /// @param _token Address of the token to unlock
    /// @param _amount The amount of tokens to unlock
    /// @param _nonce Prevent replay attacks
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @return True if tokens were unlocked successfuly
    function unlockWithPermit(
        address _token,
        uint256 _amount,
        uint256 _nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns(bool);

    // TODO delete it???
    // @notice Indicates that some tokens were locked in the source chain
    /// @param _token Address of the token to lock
    /// @param _sender The sender of the locking transaction
    /// @param _to Address of the wallet in the target chain
    /// @param _amount The amount of tokens to lock
    /// @param _direction The name of the target chain
    event Lock(
        address indexed _token,
        address indexed _sender,
        string _to,
        uint _amount,
        string _direction
    );

    // TODO delete it???
    /// @notice Indicates that some tokens were burnt in the target chain
    /// @param _token Address of the token to burn
    /// @param _sender The sender of the burning transaction
    /// @param _to Address of the wallet in the source chain
    /// @param _amount The amount of tokens to burn
    /// @param _direction The name of the source chain
    event Burn(
        address indexed _token,
        address indexed _sender,
        string _to,
        uint _amount,
        string _direction
    );

    /// @notice Indicates that some tokens were minted by permitted user
    /// @param _token Address of the token to mint
    /// @param _to Address of the wallet in the target chain
    /// @param _amount The amount of tokens to mint
    event MintWithPermit(
        address indexed _token,
        address indexed _to,
        uint _amount
    );

    /// @notice Indicates that some tokens were unlocked by permitted user
    /// @param _token Address of the token to unlock
    /// @param _to Address of the wallet in the source chain
    /// @param _amount The amount of tokens to unlock
    event UnlockWithPermit(
        address indexed _token,
        address indexed _to,
        uint _amount
    );

}
