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


import "hardhat/console.sol";

/// @title A ERC20-ERC20 bridge contract
contract Bridge is IBridge, IERC721Receiver, AccessControl, ReentrancyGuard {

    using SafeERC20 for IWrappedERC20;

    /// @dev Names of supported chains
    mapping(string => bool) public supportedChains;
    /// @dev Monitor fees for ERC20 tokens
    /// @dev Map from token address to fees
    mapping(address => uint256) public TokenFees;
    /// @dev Monitor nonces. Prevent replay attacks
    mapping(uint256 => bool) public nonces;

    bytes32 public constant BOT_MESSENGER_ROLE = keccak256("BOT_MESSENGER_ROLE");
    address public botMessenger;

    /// @dev Fee rate. Used to calculate final fee. In basis points.
    /// @dev 1 basis point = 1% / 100
    /// @dev Default fee rate is 0.3% (30 BP)
    uint256 private feeRateBp = 30; 
    /// @dev Denominator used to convert fee into percents
    /// @dev e.g. The msg.value is 50 tokens. The fee rate is 30 BP (0.3%)
    /// @dev 50 * 30 = 1500 BP
    /// @dev 1500 BP / 10 000 = 0.3%. Human readable.
    uint256 private constant percentDenominator = 10_000;
    /// @dev Fee can't be more than 100%
    uint256 private constant maxFeeRateBp = 100 * 100;

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
    constructor(
        address _botMessenger
    ) { 
        require(_botMessenger != address(0));
        // The caller becomes an admin
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // The provided address gets a special role (used in signature verification)
        botMessenger = _botMessenger;
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
    /// @param receiver The wrapped of wrapped tokens
    /// @param targetChain The name of the target chain
    /// @return True if tokens were locked successfully
    function lockNative(
        uint256 amount,
        string memory receiver,
        string memory targetChain
    ) 
    external
    // If a user wants to lock tokens - he should provide `amount+fee` native tokens
    // The fee can be calculated using `calcFee` method (only by the admin)
    payable
    isSupportedChain(targetChain)
    nonReentrant
    returns(bool) 
    {        

        address sender = msg.sender;

        // Calculate the fee and save it
        uint256 feeAmount = calcFee(amount);
        // In case of native tokens the address is zero address
        TokenFees[address(0)] += feeAmount;
        
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

            bytes32 permitDigest = getPermitDigestNative(
                amount,
                msgSender,
                nonce
            );

            // Recover the signer of the PERMIT_DIGEST
            address signer = ecrecover(permitDigest, v, r, s);
            // Compare the recover and the required signer
            require(signer == botMessenger, "Bridge: invalid signature!");

            nonces[nonce] = true;
    }

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




    //==========ERC20 Tokens Functions==========

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
    )
    external
    // If a user wants to lock tokens - he should provide `feeAmount` native tokens
    // The fee can be calculated using `calcFee` method (only by the admin)
    payable
    isSupportedChain(targetChain)
    nonReentrant
    returns(bool)
    {
        address sender = msg.sender;

        // Calculate the fee and save it
        uint256 feeAmount = calcFee(amount);
        TokenFees[token] += feeAmount;

        // Make sure that user sent enough tokens to cover both amount and fee
        require(msg.value >= feeAmount, "Bridge: not enough native tokens were sent to cover the fees!");

        // NOTE ERC20.increaseAllowance(address(this), amount) must be called on the backend 
        // before transfering the tokens

        // After this transfer all tokens are in possesion of the bridge contract and they can not be
        // withdrawn by explicitly calling `ERC20.safeTransferFrom` of `ERC20.transferFrom` because the bridge contract
        // does not provide allowance of these tokens for anyone. The only way to transfer tokens from the
        // bridge contract to some other address is to call `ERC20.safeTransfer` inside the contract itself.
        // Thus, transfered tokens are locked inside the bridge contract
        // Transfer additional fee with the initial amount of tokens
        IWrappedERC20(token).safeTransferFrom(sender, address(this), amount);

        // Emit the lock event with detailed information
        emit LockERC20(token, sender, receiver, amount, targetChain);

        return true;

    }

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
    )
    external
    // If a user wants to burn tokens - he should provide `feeAmount` native tokens
    // The fee can be calculated using `calcFee` method (only by the admin)
    payable
    isSupportedChain(targetChain)
    nonReentrant
    returns(bool)
    {   

        address sender = msg.sender;

        // Calculate the fee and save it
        uint256 feeAmount = calcFee(amount);
        TokenFees[token] += feeAmount;

        require(msg.value >= feeAmount, "Bridge: not enough native tokens were sent to cover the fees!");


        // Transfer user's tokens (and a fee) to the bridge contract from target chain account
        // NOTE This method should be called from the address on the target chain
        //IWrappedERC20(token).safeTransferFrom(sender, address(this), amount);
        // And burn them immediately
        // Burn all tokens except the fee
        IWrappedERC20(token).burn(sender, amount);

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

            bytes32 permitDigest = getPermitDigestERC20(
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


    //==========ERC721 Tokens Functions==========

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
    ) 
    external 
    // If a user wants to lock tokens - he should provide `feeAmount` native tokens
    // The fee can be calculated using `calcFee` method (only by the admin)
    payable 
    returns(bool) 
    {
        address sender = msg.sender;

        // Calculate the fee and save it
        // TODO what amount to set here?
        uint256 feeAmount = calcFee(1);
        TokenFees[token] += feeAmount;

        require(msg.value >= feeAmount, "Bridge: not enough native tokens were sent to cover the fees!");

        // NOTE ERC721.setApprovalForAll(address(this), true) must be called on the backend 
        // before transfering the tokens

        IWrappedERC721(token).safeTransferFrom(sender, address(this), tokenId);

        // Emit the lock event with detailed information
        emit LockERC721(token, tokenId, sender, receiver, targetChain);

        return true;
    }


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
    )
    external
    // If a user wants to burn tokens - he should provide `feeAmount` native tokens
    // The fee can be calculated using `calcFee` method (only by the admin)
    payable
    isSupportedChain(targetChain)
    nonReentrant
    returns(bool)
    {   

        address sender = msg.sender;

        // Calculate the fee and save it
        // TODO what amount to set here?
        uint256 feeAmount = calcFee(1);
        TokenFees[token] += feeAmount;

        require(msg.value >= feeAmount, "Bridge: not enough native tokens were sent to cover the fees!");

        IWrappedERC721(token).burn(tokenId);

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
            IWrappedERC721(token).balanceOf(address(this)) >= 0,
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

            bytes32 permitDigest = getPermitDigestERC721(
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
                    "Permit(address receiver,uint256 amount,uint256 nonce)"
                ),
                receiver,
                tokenId,
                nonce
            )
        );

        return permitHash;
    }





    //==========ERC1155 Tokens Functions==========

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
    ) 
    external 
    // If a user wants to lock tokens - he should provide `feeAmount` native tokens
    // The fee can be calculated using `calcFee` method (only by the admin)
    payable
    returns(bool) 
    {
        address sender = msg.sender;

        // Calculate the fee and save it
        // TODO what amount to set here?
        uint256 feeAmount = calcFee(amount);
        TokenFees[token] += feeAmount;

        require(msg.value >= feeAmount, "Bridge: not enough native tokens were sent to cover the fees!");

        // NOTE ERC1155.setApprovalForAll(address(this), true) must be called on the backend 
        // before transfering the tokens

        IWrappedERC1155(token).safeTransferFrom(sender, address(this), tokenId, amount, bytes("iamtoken"));

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
    /// @return True if tokens were burnt successfully
    function burnERC1155(
        address token,
        uint256 tokenId,
        uint256 amount,
        string memory receiver,
        string memory targetChain
    )
    external
    // If a user wants to burn tokens - he should provide `feeAmount` native tokens
    // The fee can be calculated using `calcFee` method (only by the admin)
    payable 
    isSupportedChain(targetChain)
    nonReentrant
    returns(bool)
    {   

        address sender = msg.sender;

        // Calculate the fee and save it
        // TODO what amount to set here?
        uint256 feeAmount = calcFee(1);
        TokenFees[token] += feeAmount;

        require(msg.value >= feeAmount, "Bridge: not enough native tokens were sent to cover the fees!");

        // Burn all tokens from user's wallet
        IWrappedERC1155(token).burn(sender, tokenId, amount);

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
            IWrappedERC1155(token).balanceOf(address(this), tokenId) >= 0,
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

            bytes32 permitDigest = getPermitDigestERC1155(
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
        bytes32 typeHash = getPermitTypeHashERC1155(amount, receiver, nonce);

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
    /// @param receiver The receiver of transfered token
    /// @param nonce Unique number to prevent replay
    function getPermitTypeHashERC1155(
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



    /// @notice Sets the admin
    /// @param newAdmin Address of the admin   
    function setAdmin(address newAdmin) external onlyAdmin {
        grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
    }

    /// @notice Sets a new fee rate for bridge operations
    /// @param newFeeRateBp A new rate in basis points
    function setFeeRate(uint256 newFeeRateBp) external onlyAdmin {
        require(newFeeRateBp > 0 && newFeeRateBp <= maxFeeRateBp, "Bridge: fee rate is too high!");
        feeRateBp = newFeeRateBp;
    }

    /// @notice Calculates a fee for bridge operations
    /// @notice Fee can not be less than 1
    /// @param amount An amount of tokens that were sent
    /// @return The fee amount in atomic tokens of the chain (e.g. wei in Ethereum)
    function calcFee(uint256 amount) public view returns(uint256) {
        uint256 result = amount * feeRateBp / percentDenominator;
        // TODO this line works well for natives or erc20, but not for erc721 or erc1155
        //require(result >= 1, "Bridge: transaction amount too low for fees!");
        return result;
    }


    /// @notice Withdraws fees accumulated from a specific token operations
    /// @param token The address of the token which transfers collected fees (zero address for native token)
    /// @param amount The amount of fees from a single token to be withdrawn
    function withdraw(address token, uint256 amount) external nonReentrant onlyAdmin {
        require(TokenFees[token] != 0, "Bridge: no fees were collected for this token!");
        require(TokenFees[token] >= amount, "Bridge: amount of fees to withdraw is too large!");
        
        TokenFees[token] -= amount;
        
        (bool success, ) = msg.sender.call{ value: amount }("");
        require(success, "Bridge: tokens withdrawal failed!");

        emit Withdraw(msg.sender, amount);

    }

    /// @notice Adds a chain supported by the bridge
    /// @param chain The name of the chain
    function setSupportedChain(string memory chain) external onlyAdmin {
        supportedChains[chain] = true;
    }

    /// @notice Removes a chain supported by the bridge
    /// @param chain The name of the chain
    function removeSupportedChain(string memory chain) external onlyAdmin {
        supportedChains[chain] = false;
    }


}