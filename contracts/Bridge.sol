// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

import "./interfaces/IBridge.sol";
import "./interfaces/IWrappedERC20.sol";
import "./interfaces/IWrappedERC721.sol";
import "./interfaces/IWrappedERC1155.sol";

import "./libraries/EIP712Utils.sol";

import "hardhat/console.sol";

/// @title A ERC20-ERC20 bridge contract
contract Bridge is IBridge, IERC721Receiver, AccessControl, ReentrancyGuard {

    using SafeERC20 for IWrappedERC20;

    /// @dev Names of supported chains
    mapping(string => bool) public supportedChains;
    /// @dev Monitor fees for ERC20 tokens
    /// @dev Map from token address to fees
    mapping(address => uint256) public tokenFees;
    /// @dev Monitor nonces. Prevent replay attacks
    mapping(uint256 => bool) public nonces;

    bytes32 public constant BOT_MESSENGER_ROLE = keccak256("BOT_MESSENGER_ROLE");
    address public botMessenger;
    address public stablecoin;
    address public stargateToken;
    /// @dev Last verified nonce
    uint256 public lastNonce;

    //========== Fees ==========

    uint256 private constant PERCENT_DENOMINATOR = 100_000;

    uint256 private constant MIN_ERC20_ST_FEE_USD = 750;//$0.0075
    uint256 private constant MAX_ERC20_ST_FEE_USD = 15000;//$0.15
    uint256 private constant MIN_ERC20_TT_FEE_USD = 1000;//$0.01
    uint256 private constant MAX_ERC20_TT_FEE_USD = 20000;//$0.2
    uint256 private constant ERC20_ST_FEE_RATE = 225;//0.225%
    uint256 private constant ERC20_TT_FEE_RATE = 300;//0.3%
    uint256 private constant ERC721_1155_ST_FEE_USD = 20000;//$0.2 
    uint256 private constant ERC721_1155_FEE_USD = 30000;//$0.3

    /// @dev Checks if caller is an admin
    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Bridge: the caller is not an admin!");
        _;
    }

    /// @dev Checks the contracts is supported on the given chain
    modifier isSupportedChain(string memory chain) {
        require(supportedChains[chain], "Bridge: the chain is not supported!");
        _;
    }

    /// @notice Initializes internal variables, sets roles
    /// @param _botMessenger The address of bot messenger
    /// @param _stablecoin The address of USD stablecoin
    /// @param _stargateToken The address of stargate token 
    constructor(
        address _botMessenger,
        address _stablecoin,
        address _stargateToken
    ) { 
        require(_botMessenger != address(0), "Bridge: default bot messenger can not be zero address!");
        require(_stablecoin != address(0), "Bridge: stablecoin can not be zero address!");
        require(_stargateToken != address(0), "Bridge: stargate token can not be zero address!");
        // The caller becomes an admin
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // The provided address gets a special role (used in signature verification)
        botMessenger = _botMessenger;
        stablecoin = _stablecoin;
        stargateToken = _stargateToken;
        _setupRole(BOT_MESSENGER_ROLE, botMessenger);

    }

    /// @notice Allow this contract to receiver ERC721 tokens
    /// @dev Should return the selector of itself
    /// @dev Whenever an ERC721 token is transferred to this contract 
    ///      via ERC721.safeTransferFrom this function is called   
    function onERC721Received(address operator, address from, uint256 tokeid, bytes calldata data)
    public 
    returns (bytes4) 
    {
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Allow this contract to receiver ERC1155 tokens
    /// @dev Should return the selector of itself
    /// @dev Whenever an ERC1155 token is transferred to this contract 
    ///      via ERC1155.safeTransferFrom this function is called   
    function onERC1155Received(address operator, address from, uint256 tokeid, uint256 amount, bytes calldata data)
    public 
    returns (bytes4) 
    {
        return IERC1155Receiver.onERC1155Received.selector;
    }


    //==========Native Tokens Functions==========

    /// @notice Locks native tokens on the source chain
    /// @param amount The amount of tokens to lock
    /// @param receiver The receiver of wrapped tokens
    /// @param targetChain The name of the target chain
    /// @param stargateAmountForOneUsd Stargate tokens (ST) amount for one USD
    /// @param transferedTokensAmountForOneUsd TT tokens amount for one USD
    /// @param payFeesWithST true if user choose to pay fees with stargate tokens
    /// @return True if tokens were locked successfully
    function lockWithPermitNative(
        uint256 amount,
        string memory receiver,
        string memory targetChain,
        uint256 stargateAmountForOneUsd,
        uint256 transferedTokensAmountForOneUsd,
        bool payFeesWithST
    ) 
    external
    // If a user wants to lock tokens and pay fees in native tokens
    // he should provide `amount+fee` native tokens
    // The fee can be calculated using `calcFeeScaled` method
    payable
    isSupportedChain(targetChain)
    nonReentrant
    returns(bool) 
    {        

        address sender = msg.sender;
        // Calculate the fee and save it
        uint256 feeAmount = calcFeeScaled(
            amount,
            stargateAmountForOneUsd,
            transferedTokensAmountForOneUsd,
            payFeesWithST
        );
        
        if(payFeesWithST)
            payFees(sender, stargateToken, feeAmount);
        else
        // Make sure that user sent enough tokens to cover both amount and fee
            require(msg.value >= amount + feeAmount, "Bridge: not enough native tokens were sent to cover the fees!");

        emit LockNative(sender, receiver, amount, targetChain);

        return true;
    }

    /**
     * NOTE Sections with other types of tokens have `burn` function here. 
     * There is no scenario where after transfer through the bridge native tokens of the target
     * chain will be minted to the user's address. Only ERC20, ERC721 or ERC1155 can. Thus no
     * native tokens can be burnt before transfering tokens backwards.
     */

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
    )
    external
    nonReentrant
    returns(bool)
    {
        address sender = msg.sender;

        // Check if there is enough native tokens on the bridge (no fees)
        require(
            address(this).balance >= amount,
            "Bridge: not enough native tokens on the bridge balance!"
        );

        // Verify the signature (contains v, r, s) using the domain separator
        // This will prove that the user has burnt tokens on the target chain
        signatureVerificationNative(amount, sender, nonce, v, r, s);

        // Transfer native tokens of the original chain from the bridge to the caller
        (bool success, ) = sender.call{ value: amount }("");
        require(success, "Bridge: tokens unlock failed!");

        emit UnlockWithPermitNative(sender, amount);

        return true;
        
    }

    /// @dev Verifies that a signature of PERMIT_DIGEST for native tokens is valid 
    /// @param amount The amount of tokens of the digest
    /// @param msgSender The address of account on another chain
    /// @param nonce Prevent replay attacks
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    function signatureVerificationNative(
        uint256 amount,
        address msgSender,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
            require(!nonces[nonce], "Bridge: request already processed!");

            bytes32 permitDigest = EIP712Utils.getPermitDigestNative(
                amount,
                msgSender,
                nonce
            );

            // Recover the signer of the PERMIT_DIGEST
            address signer = ecrecover(permitDigest, v, r, s);
            // Compare the recover and the required signer
            require(signer == botMessenger, "Bridge: invalid signature!");

            nonces[nonce] = true;
            lastNonce = nonce;
    }

    //==========ERC20 Tokens Functions==========

    /// @notice Locks ERC20 tokens on the source chain
    /// @param token Address of the token to lock
    /// @param amount The amount of tokens to lock
    /// @param receiver The receiver of wrapped tokens
    /// @param targetChain The name of the target chain
    /// @param stargateAmountForOneUsd Stargate tokens (ST) amount for one USD
    /// @param transferedTokensAmountForOneUsd TT tokens amount for one USD
    /// @param payFeesWithST true if user choose to pay fees with stargate tokens
    /// @return True if tokens were locked successfully
    function lockWithPermitERC20(
        address token,
        uint256 amount,
        string memory receiver,
        string memory targetChain,
        uint256 stargateAmountForOneUsd,
        uint256 transferedTokensAmountForOneUsd,
        bool payFeesWithST
    )
    external
    isSupportedChain(targetChain)
    nonReentrant
    returns(bool)
    {
        address sender = msg.sender;

        // Calculate the fee and save it
        uint256 feeAmount = calcFeeScaled(
            amount,
            stargateAmountForOneUsd,
            transferedTokensAmountForOneUsd,
            payFeesWithST
        );

        // NOTE ERC20.increaseAllowance(address(this), amount) must be called on the backend 
        // before transfering the tokens

        // After this transfer all tokens are in possesion of the bridge contract and they can not be
        // withdrawn by explicitly calling `ERC20.safeTransferFrom` of `ERC20.transferFrom` because the bridge contract
        // does not provide allowance of these tokens for anyone. The only way to transfer tokens from the
        // bridge contract to some other address is to call `ERC20.safeTransfer` inside the contract itself.
        // Thus, transfered tokens are locked inside the bridge contract
        // Transfer additional fee with the initial amount of tokens
        IWrappedERC20(token).safeTransferFrom(sender, address(this), amount);

        if(payFeesWithST)
            payFees(sender, stargateToken, feeAmount);
        else
            payFees(sender, token, feeAmount);
        // Emit the lock event with detailed information
        emit LockERC20(token, sender, receiver, amount, targetChain);

        return true;

    }

    /// @notice Burns ERC20 tokens on a target chain
    /// @param token The address of the token to burn
    /// @param amount The amount of tokens to burn
    /// @param receiver The receiver of unlocked tokens on the original chain (not only EVM)
    /// @param targetChain The name of the target chain
    /// @param stargateAmountForOneUsd Stargate tokens (ST) amount for one USD
    /// @param transferedTokensAmountForOneUsd TT tokens amount for one USD
    /// @param payFeesWithST true if user choose to pay fees with stargate tokens
    /// @return True if tokens were burnt successfully
    function burnWithPermitERC20(
        address token,
        uint256 amount,
        string memory receiver,
        string memory targetChain,
        uint256 stargateAmountForOneUsd,
        uint256 transferedTokensAmountForOneUsd,
        bool payFeesWithST
    )
    external
    isSupportedChain(targetChain)
    nonReentrant
    returns(bool)
    {   

        address sender = msg.sender;

        // Calculate the fee and save it
        uint256 feeAmount = calcFeeScaled(
            amount,
            stargateAmountForOneUsd,
            transferedTokensAmountForOneUsd,
            payFeesWithST
        );

        // Transfer user's tokens (and a fee) to the bridge contract from target chain account
        // NOTE This method should be called from the address on the target chain
        //IWrappedERC20(token).safeTransferFrom(sender, address(this), amount);
        // And burn them immediately
        // Burn all tokens except the fee
        IWrappedERC20(token).burn(sender, amount);

        if(payFeesWithST)
            payFees(sender, stargateToken, feeAmount);
        else
            payFees(sender, token, feeAmount);

        emit BurnERC20(token, sender, receiver, amount, targetChain);
        return true;
    }

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
    )
    external
    nonReentrant
    returns(bool)
    {   

        address sender = msg.sender;

        // Verify the signature (contains v, r, s) using the domain separator
        // This will prove that the user has locked tokens on the source chain
        signatureVerificationERC20(token, amount, nonce, sender, v, r, s);
        // Mint wrapped tokens to the user's address on the target chain
        // NOTE This method should be called from the address on the target chain 
        IWrappedERC20(token).mint(sender, amount);

        emit MintWithPermitERC20(token, sender, amount);

        return true;
    }

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
    )
    external
    nonReentrant
    returns(bool)
    {
        address sender = msg.sender;

        // Check if there is enough custom tokens on the bridge (no fees)
        require(
            IWrappedERC20(token).balanceOf(address(this)) >= amount,
            "Bridge: not enough ERC20 tokens on the bridge balance!"
        );


        // Verify the signature (contains v, r, s) using the domain separator
        // This will prove that the user has burnt tokens on the target chain
        signatureVerificationERC20(token, amount, nonce, sender, v, r, s);

        // This is the only way to withdraw locked tokens from the bridge contract
        // (see `lock` method of this contract)
        IWrappedERC20(token).safeTransfer(sender, amount);

        emit UnlockWithPermitERC20(token, sender, amount);

        return true;  
        
    }


    /// @dev Verifies that a signature of PERMIT_DIGEST for ERC20 tokens is valid 
    /// @param token The address of transfered token
    /// @param amount The amount of tokens of the digest
    /// @param msgSender The address of account on another chain
    /// @param nonce Prevent replay attacks
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    function signatureVerificationERC20(
        address token,
        uint256 amount,
        uint256 nonce,
        address msgSender,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
            require(!nonces[nonce], "Bridge: request already processed!");

            bytes32 permitDigest = EIP712Utils.getPermitDigestERC20(
                token,
                amount,
                msgSender,
                nonce
            );

            // Recover the signer of the PERMIT_DIGEST
            address signer = ecrecover(permitDigest, v, r, s);
            // Compare the recover and the required signer
            require(signer == botMessenger, "Bridge: invalid signature!");

            nonces[nonce] = true;
            lastNonce = nonce;
    }

    //==========ERC721 Tokens Functions==========

    /// @notice Locks ERC721 token on the source chain
    /// @param token The address of the token to lock
    /// @param tokenId The ID of the token to lock
    /// @param receiver The receiver of wrapped tokens
    /// @param targetChain The name of the target chain
    /// @param stargateAmountForOneUsd Stargate tokens (ST) amount for one USD
    /// @param payFeesWithST true if user choose to pay fees with stargate tokens
    /// @return True if tokens were locked successfully
    function lockWithPermitERC721(
        address token,
        uint256 tokenId,
        string memory receiver,
        string memory targetChain,
        uint256 stargateAmountForOneUsd,
        bool payFeesWithST
    ) 
    external 
    returns(bool) 
    {
        address sender = msg.sender;

        // Calculate the fee and save it
        uint256 feeAmount = calcFeeFixed(
            1,
            stargateAmountForOneUsd,
            payFeesWithST
        );

        // NOTE ERC721.setApprovalForAll(address(this), true) must be called on the backend 
        // before transfering the tokens

        IWrappedERC721(token).safeTransferFrom(sender, address(this), tokenId);

        if(payFeesWithST)
            payFees(sender, stargateToken, feeAmount);
        else
            payFees(sender, token, feeAmount);

        // Emit the lock event with detailed information
        emit LockERC721(token, tokenId, sender, receiver, targetChain);

        return true;
    }


    /// @notice Burns ERC721 tokens on a target chain
    /// @param token The address of the token to burn 
    /// @param tokenId The ID of the token to lock
    /// @param receiver The receiver of unlocked tokens on the original chain (not only EVM)
    /// @param targetChain The name of the target chain
    /// @param stargateAmountForOneUsd Stargate tokens (ST) amount for one USD
    /// @param payFeesWithST true if user choose to pay fees with stargate tokens
    /// @return True if tokens were burnt successfully
    function burnWithPermitERC721(
        address token,
        uint256 tokenId,
        string memory receiver,
        string memory targetChain,
        uint256 stargateAmountForOneUsd,
        bool payFeesWithST
    )
    external
    isSupportedChain(targetChain)
    nonReentrant
    returns(bool)
    {   

        address sender = msg.sender;

        // Calculate the fee and save it
        uint256 feeAmount = calcFeeFixed(
            1,
            stargateAmountForOneUsd,
            payFeesWithST
        );

        IWrappedERC721(token).burn(tokenId);

        if(payFeesWithST)
            payFees(sender, stargateToken, feeAmount);
        else
            payFees(sender, stablecoin, feeAmount);

        emit BurnERC721(token, tokenId, sender, receiver, targetChain);

        return true;
    }


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
    )
    external
    nonReentrant
    returns(bool)
    {   

        address sender = msg.sender;

        // Verify the signature (contains v, r, s) using the domain separator
        // This will prove that the user has locked tokens on the source chain
        signatureVerificationERC721(nonce, tokenId, v, r, s, token, sender);
        // Mint wrapped tokens to the user's address on the target chain
        // NOTE This method should be called from the address on the target chain 
        IWrappedERC721(token).mint(sender, tokenId);

        emit MintWithPermitERC721(token, tokenId, sender);

        return true;
    }


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
    )
    external
    nonReentrant
    returns(bool)
    {
        address sender = msg.sender;

        // Check if there is enough custom tokens on the bridge (no fees)
        require(
            IWrappedERC721(token).balanceOf(address(this)) > 0,
            "Bridge: not enough ERC721 tokens on the bridge balance!"
        );


        // Verify the signature (contains v, r, s) using the domain separator
        // This will prove that the user has burnt tokens on the target chain
        signatureVerificationERC721(nonce, tokenId, v, r, s, token, sender);

        IWrappedERC721(token).safeTransferFrom(address(this), sender, tokenId);

        emit UnlockWithPermitERC721(token, tokenId, sender);

        return true;  
        
    }


    /// @dev Verifies that a signature of PERMIT_DIGEST for ERC721 tokens is valid 
    /// @param nonce Prevent replay attacks
    /// @param tokenId The ID of transfered token
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @param token The address of the transered token
    /// @param msgSender The address of account on another chain
    function signatureVerificationERC721(
        uint256 nonce,
        uint256 tokenId,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address token,
        address msgSender
    ) internal {
            require(!nonces[nonce], "Bridge: request already processed!");

            bytes32 permitDigest = EIP712Utils.getPermitDigestERC721(
                token,
                tokenId,
                msgSender,
                nonce
            );

            // Recover the signer of the PERMIT_DIGEST
            address signer = ecrecover(permitDigest, v, r, s);
            // Compare the recover and the required signer
            require(signer == botMessenger, "Bridge: invalid signature!");

            nonces[nonce] = true;
            lastNonce = nonce;
    }

    //==========ERC1155 Tokens Functions==========

    /// @notice Locks ERC1155 token on the source chain
    /// @param token The address of the token to lock
    /// @param tokenId The ID of token type
    /// @param amount The amount of tokens of specifi type
    /// @param receiver The receiver of wrapped tokens
    /// @param targetChain The name of the target chain
    /// @param stargateAmountForOneUsd Stargate tokens (ST) amount for one USD
    /// @param payFeesWithST true if user choose to pay fees with stargate tokens
    /// @return True if tokens were locked successfully
    function lockWithPermitERC1155(
        address token,
        uint256 tokenId,
        uint amount,
        string memory receiver,
        string memory targetChain,
        uint256 stargateAmountForOneUsd,
        bool payFeesWithST
    ) 
    external 
    returns(bool) 
    {
        address sender = msg.sender;

        // Calculate the fee and save it
        uint256 feeAmount = calcFeeFixed(
            amount,
            stargateAmountForOneUsd,
            payFeesWithST
        );

        // NOTE ERC1155.setApprovalForAll(address(this), true) must be called on the backend 
        // before transfering the tokens

        IWrappedERC1155(token).safeTransferFrom(sender, address(this), tokenId, amount, bytes("iamtoken"));

        if(payFeesWithST)
            payFees(sender, stargateToken, feeAmount);
        else
            payFees(sender, stablecoin, feeAmount);

        // Emit the lock event with detailed information
        emit LockERC1155(token, tokenId, sender, receiver, amount, targetChain);

        return true;
    }


    /// @notice Burns ERC1155 tokens on a target chain
    /// @param token The address of the token to burn
    /// @param tokenId The ID of the token to lock
    /// @param amount The amount of tokens of specific type
    /// @param receiver The receiver of unlocked tokens on the original chain (not only EVM)
    /// @param targetChain The name of the target chain
    /// @param stargateAmountForOneUsd Stargate tokens (ST) amount for one USD
    /// @param payFeesWithST true if user choose to pay fees with stargate tokens
    /// @return True if tokens were burnt successfully
    function burnWithPermitERC1155(
        address token,
        uint256 tokenId,
        uint256 amount,
        string memory receiver,
        string memory targetChain,
        uint256 stargateAmountForOneUsd,
        bool payFeesWithST
    )
    external
    isSupportedChain(targetChain)
    nonReentrant
    returns(bool)
    {   

        address sender = msg.sender;

        // Calculate the fee and save it
        uint256 feeAmount = calcFeeFixed(
            amount,
            stargateAmountForOneUsd,
            payFeesWithST
        );

        // Burn all tokens from user's wallet
        IWrappedERC1155(token).burn(sender, tokenId, amount);

        if(payFeesWithST)
            payFees(sender, stargateToken, feeAmount);
        else
            payFees(sender, stablecoin, feeAmount);

        emit BurnERC1155(token, tokenId, sender, receiver, amount, targetChain);

        return true;
    }

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
    )
    external
    nonReentrant
    returns(bool)
    {   

        address sender = msg.sender;

        // Verify the signature (contains v, r, s) using the domain separator
        // This will prove that the user has locked tokens on the source chain
        signatureVerificationERC1155(token, tokenId, amount, sender, nonce, v, r, s);
        // Mint wrapped tokens to the user's address on the target chain
        // NOTE This method should be called from the address on the target chain 
        IWrappedERC1155(token).mint(sender, tokenId, amount);

        emit MintWithPermitERC1155(token, tokenId, sender, amount);

        return true;
    }

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
    )
    external
    nonReentrant
    returns(bool)
    {
        address sender = msg.sender;

        // Check if there is enough custom tokens on the bridge (no fees)
        require(
            IWrappedERC1155(token).balanceOf(address(this), tokenId) > 0,
            "Bridge: not enough ERC1155 tokens on the bridge balance!"
        );


        // Verify the signature (contains v, r, s) using the domain separator
        // This will prove that the user has burnt tokens on the target chain
        signatureVerificationERC1155(token, tokenId, amount, sender, nonce, v, r, s);

        IWrappedERC1155(token).safeTransferFrom(address(this), sender, tokenId, amount, bytes("iamtoken"));

        emit UnlockWithPermitERC1155(token, tokenId, sender, amount);

        return true;  
        
    }

    /// @dev Verifies that a signature of PERMIT_DIGEST for ERC1155 tokens is valid 
    /// @param token The address of transfered
    /// @param tokenId The ID of transfered token
    /// @param amount The amount of tokens of specific type
    /// @param msgSender The address of account on another chain
    /// @param nonce Prevent replay attacks
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param s 32-64 bytes of the signed PERMIT_DIGEST
    function signatureVerificationERC1155(
        address token,
        uint256 tokenId,
        uint256 amount,
        address msgSender,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
            require(!nonces[nonce], "Bridge: request already processed!");

            bytes32 permitDigest = EIP712Utils.getPermitDigestERC1155(
                token,
                tokenId,
                amount,
                msgSender,
                nonce
            );

            // Recover the signer of the PERMIT_DIGEST
            address signer = ecrecover(permitDigest, v, r, s);
            // Compare the recover and the required signer
            require(signer == botMessenger, "Bridge: invalid signature!");

            nonces[nonce] = true;
            lastNonce = nonce;
    }

    //==========Helper Functions==========


    /// @notice Sets the admin
    /// @param newAdmin Address of the admin   
    function setAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Bridge: new admin can not have a zero address!");
        grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
        emit SetAdmin(newAdmin);
    }

    /// @notice Calculates a fee for bridge operations with ERC20 and native tokens
    /// @param amount An amount of TT tokens that were sent
    /// @param stargateAmountForOneUsd Stargate tokens (ST) amount for one USD
    /// @param transferedTokensAmountForOneUsd TT tokens amount for one USD
    /// @param payFeesWithST true if user choose to pay fees with stargate tokens
    /// @return The fee amount in ST or TT depending on user's preferences
    function calcFeeScaled(
        uint256 amount,
        uint256 stargateAmountForOneUsd,
        uint256 transferedTokensAmountForOneUsd,
        bool payFeesWithST
    ) public pure returns(uint256) {
        uint256 result;

        if(payFeesWithST) {
            //TT * fee rate => USD
            result = amount * ERC20_ST_FEE_RATE / transferedTokensAmountForOneUsd;
            result = result > MIN_ERC20_ST_FEE_USD ? result : MIN_ERC20_ST_FEE_USD;
            result = result < MAX_ERC20_ST_FEE_USD ? result : MAX_ERC20_ST_FEE_USD;
            //USD => ST
            result = result * stargateAmountForOneUsd / PERCENT_DENOMINATOR;
        }
        else if(transferedTokensAmountForOneUsd == 0) {
            result = amount * ERC20_TT_FEE_RATE / PERCENT_DENOMINATOR;
        } else {
            //TT * fee rate => USD
            result = amount * ERC20_TT_FEE_RATE / transferedTokensAmountForOneUsd;
            result = result > MIN_ERC20_TT_FEE_USD ? result : MIN_ERC20_TT_FEE_USD;
            result = result < MAX_ERC20_TT_FEE_USD ? result : MAX_ERC20_TT_FEE_USD;
            //USD => TT
            result = result * transferedTokensAmountForOneUsd / PERCENT_DENOMINATOR;
        }
        return result;
    }

    /// @notice Calculates a fee for bridge operations with ERC721 and ERC1155 tokens
    /// @param amount An amount of tokens that were sent (always 1 if ERC721)
    /// @param stargateAmountForOneUsd Stargate tokens (ST) amount for one USD
    /// @param payFeesWithST true if user choose to pay fees with stargate tokens
    /// @return The fee amount in ST or USD depending on user's preferences
    function calcFeeFixed(
        uint256 amount,
        uint256 stargateAmountForOneUsd,
        bool payFeesWithST
    ) public view returns(uint256) {
        uint256 result;
        if(payFeesWithST) {
            result = amount * (stargateAmountForOneUsd * ERC721_1155_ST_FEE_USD);
            result = result / PERCENT_DENOMINATOR;
        }
        else {
            result = amount * IWrappedERC20(stablecoin).decimals() * ERC721_1155_FEE_USD;
            result = result / PERCENT_DENOMINATOR;
        }
        return result;
    }

    /// @notice Transfer fees from user's wallet to contract address
    /// @param sender user's address
    /// @param token address pf token in which fees are paid
    /// @param feeAmount fee amount
    function payFees(address sender, address token, uint256 feeAmount) internal {
        tokenFees[token] += feeAmount;
        IWrappedERC20(token).safeTransferFrom(sender, address(this), feeAmount);
    }

    /// @notice Withdraws fees accumulated from a specific token operations
    /// @param token The address of the token which transfers collected fees
    /// @param amount The amount of fees from a single token to be withdrawn
    function withdraw(address token, uint256 amount) external nonReentrant onlyAdmin {
        require(tokenFees[token] != 0, "Bridge: no fees were collected for this token!");
        require(tokenFees[token] >= amount, "Bridge: amount of fees to withdraw is too large!");
        
        tokenFees[token] -= amount;
        
        IWrappedERC20(token).safeTransfer(msg.sender, amount);
        //require(success, "Bridge: tokens withdrawal failed!");

        emit Withdraw(msg.sender, amount);

    }

    /// @notice Adds a chain supported by the bridge
    /// @param newChain The name of the chain
    function setSupportedChain(string memory newChain) external onlyAdmin {
        supportedChains[newChain] = true;
        emit SetNewChain(newChain);
    }

    /// @notice Removes a chain supported by the bridge
    /// @param oldChain The name of the chain
    function removeSupportedChain(string memory oldChain) external onlyAdmin {
        supportedChains[oldChain] = false;
        emit RemoveChain(oldChain);
    }
}
