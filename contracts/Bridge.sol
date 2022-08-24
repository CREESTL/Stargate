// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

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
    /// @dev Whenever an IERC721 token is transferred to this contract 
    ///      via IERC721.safeTransferFrom this function is called   
    function onERC721Received(address operator, address from, uint256 tokeid, bytes calldata data)
    public 
    returns (bytes4) 
    {
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Locks native tokens on the source chain
    /// @param amount The amount of tokens to lock
    /// @param receiver The receiver of wrapped tokens
    /// @param targetChain The name of the target chain
    /// @return True if tokens were locked successfully
    function lockNative(
        uint256 amount,
        string memory receiver,
        string memory targetChain
    ) 
    external
    payable // User has to provide amount + feeAmount of tokens for function to work
    isSupportedChain(targetChain)
    nonReentrant
    returns(bool) 
    {        

        address sender = msg.sender;

        // Calculate the fee and save it
        uint256 feeAmount = calcFee(amount);
        // In case of native tokens the address is zero address
        TokenFees[address(0)] += feeAmount;
        
        // User provides some native tokens to the bridge when calling this `lock` method so no
        // need to transfer any tokens here once more
        // Make sure that he sent enough tokens to cover both amount and fee
        require(msg.value >= amount + feeAmount, "Bridge: not enough tokens to cover the fee!");

        emit LockNative(sender, receiver, amount, targetChain);

        return true;
    }


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
    // If a user wants to lock native tokens - he should provide `amount+fee` native tokens
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

     
        // NOTE ERC20.increaseAllowance(address(this), amount + feeAmount) must be called on the backend 
        // before transfering the tokens

        // After this transfer all tokens are in possesion of the bridge contract and they can not be
        // withdrawn by explicitly calling `ERC20.safeTransferFrom` of `ERC20.transferFrom` because the bridge contract
        // does not provide allowance of these tokens for anyone. The only way to transfer tokens from the
        // bridge contract to some other address is to call `ERC20.safeTransfer` inside the contract itself.
        // Thus, transfered tokens are locked inside the bridge contract
        // Transfer additional fee with the initial amount of tokens
        IWrappedERC20(token).safeTransferFrom(sender, address(this), amount + feeAmount);

        // Emit the lock event with detailed information
        emit LockERC20(token, sender, receiver, amount, targetChain);

        return true;

    }

    /// @notice Locks ERC721 token on the source chain
    /// @param token The address of the token to lock
    /// @param tokenId The ID of the token to lock
    /// @param receiver The receiver of wrapped tokens
    /// @param targetChain The name of the target chain
    /// @return True if tokens were locked successfully
    function lockERC721(
        // TODO are both token and tokenId necessary? 
        address token,
        uint256 tokenId,
        string memory receiver,
        string memory targetChain
    ) 
    external 
    payable // Fees for ERC721 are payed in wei
    returns(bool) 
    {
        address sender = msg.sender;

        // Calculate the fee and save it
        // TODO what amount to set here?
        uint256 feeAmount = calcFee(1);
        TokenFees[token] += feeAmount;

     
        // NOTE ERC721.setApprovalForAll(address(this), true) must be called on the backend 
        // before transfering the tokens

        IWrappedERC721(token).safeTransferFrom(sender, address(this), tokenId);

        // Emit the lock event with detailed information
        emit LockERC721(tokenId, sender, receiver, targetChain);

        return true;
    }


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
    payable // Fees for ERC721 are payed in wei
    returns(bool) 
    {
        address sender = msg.sender;

        // Calculate the fee and save it
        // TODO what amount to set here?
        uint256 feeAmount = calcFee(amount);
        TokenFees[token] += feeAmount;

     
        // NOTE ERC1155.setApprovalForAll(address(this), true) must be called on the backend 
        // before transfering the tokens

        IWrappedERC1155(token).safeTransferFrom(sender, address(this), tokenId);

        // Emit the lock event with detailed information
        emit LockERC1155(tokenId, amount, sender, receiver, targetChain);

        return true;
    }

    /// @notice Burns tokens on a target chain
    /// @param token Address of the token to burn (zero address for native tokens)
    /// @param amount The amount of tokens to burn
    /// @param receiver The receiver of unlocked tokens on the original chain (not only EVM)
    /// @param targetChain The name of the target chain
    /// @return True if tokens were burnt successfully
    function burn(
        address token,
        uint256 amount,
        string memory receiver,
        string memory targetChain
    )
    external
    isSupportedChain(targetChain)
    nonReentrant
    returns(bool)
    {   
        // Only WrappedERC20 tokens can be burned, because only WrappedERC20 are minted on target chain
        // Example between Ethereum and Polygon:
        // Lock: ETH (Ethereum) -> wETH(Polygon)
        // Burn:
        //     correct: wETH(Polygon) -> ETH(Ethereum)
        //     incorrect: MATIC(Polygon) -> ETH(Ethereum)

        address sender = msg.sender;

        // Calculate the fee and save it
        uint256 feeAmount = calcFee(amount);
        TokenFees[token] += feeAmount;

        // NOTE ERC20.increaseAllowance(address(this), amount + feeAmount) must be called on the backend 
        // before transfering the tokens

        // Transfer user's tokens (and a fee) to the bridge contract from target chain account
        // NOTE This method should be called from the address on the target chain
        IWrappedERC20(token).safeTransferFrom(sender, address(this), amount + feeAmount);
        // And burn them immediately
        // Burn all tokens except the fee
        IWrappedERC20(token).burn(address(this), amount);

        emit Burn(token, sender, receiver, amount, targetChain);

        return true;
    }


    /// @notice Mints target tokens if the user is permitted to do so
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
    )
    external
    nonReentrant
    returns(bool)
    {   
        // Only WrappedERC20 tokens can be minted on the target chain. 
        // Native tokens of target chain can not be an equivalent of any tokens of the original chain
        address sender = msg.sender;

        // Verify the signature (contains v, r, s) using the domain separator
        // This will prove that the user has locked tokens on the source chain
        signatureVerificationERC20(nonce, amount, v, r, s, token, sender);
        // Mint wrapped tokens to the user's address on the target chain
        // NOTE This method should be called from the address on the target chain 
        IWrappedERC20(token).mint(sender, amount);

        emit MintWithPermit(token, sender, amount);

        return true;
    }

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
        signatureVerificationNative(nonce, amount, v, r, s, sender);

        // Transfer native tokens of the original chain from the bridge to the caller
        (bool success, ) = sender.call{ value: amount }("");
        require(success, "Bridge: tokens unlock failed!");

        emit UnlockWithPermitNative(sender, amount);

        return true;
        
    }

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
        signatureVerificationERC20(nonce, amount, v, r, s, token, sender);

        // This is the only way to withdraw locked tokens from the bridge contract
        // (see `lock` method of this contract)
        IWrappedERC20(token).safeTransfer(sender, amount);

        emit UnlockWithPermitERC20(token, sender, amount);

        return true;  
        
    }

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

        // TODO might be wrong arguments here
        IWrappedERC721(token).safeTransferFrom(address(this), sender, tokenId);

        emit UnlockWithPermitERC721(tokenId, sender);

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
            IWrappedERC1155(token).balanceOf(address(this)) >= 0,
            "Bridge: not enough ERC721 tokens on the bridge balance!"
        );


        // Verify the signature (contains v, r, s) using the domain separator
        // This will prove that the user has burnt tokens on the target chain
        signatureVerificationERC1155(nonce, tokenId, v, r, s, amount, sender);

        // TODO might be wrong arguments here
        IWrappedERC721(token).safeTransferFrom(address(this), sender, amount);

        emit UnlockWithPermitERC1155(tokenId, amount, sender);

        return true;  
        
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
        require(result >= 1, "Bridge: transaction amount too low for fees!");
        return result;
    }


    /// @notice Withdraws fees accumulated from a specific token operations
    /// @param token The address of the token (zero address for native token)
    /// @param amount The amount of fees from a single token to be withdrawn
    function withdraw(address token, uint256 amount) external nonReentrant onlyAdmin {
        require(TokenFees[token] != 0, "Bridge: no fees were collected for this token!");
        require(TokenFees[token] >= amount, "Bridge: amount of fees to withdraw is too large!");
        
        TokenFees[token] -= amount;
        
        // Custom token
        if (token != address(0)) {
            IWrappedERC20(token).safeTransfer(msg.sender, amount);

        // Native token
        } else {
            (bool success, ) = msg.sender.call{ value: amount }("");
            require(success, "Bridge: tokens withdrawal failed!");
        }

        emit Withdraw(token, msg.sender, amount);

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

    //==========Native Tokens Signatures==========

    /// @dev Verifies that a signature of PERMIT_DIGEST for native tokens is valid 
    /// @param nonce Prevent replay attacks
    /// @param amount The amount of tokens of the digest
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @param msgSender The address of account on another chain
    function signatureVerificationNative(
        uint256 nonce,
        uint256 amount,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address msgSender
    ) internal {
            require(!nonces[nonce], "Bridge: request already processed!");

            bytes32 permitDigest = getPermitDigestNative(
                msgSender,
                amount,
                nonce
            );

            // Recover the signer of the PERMIT_DIGEST
            address signer = ecrecover(permitDigest, v, r, s);
            // Compare the recover and the required signer
            require(signer == botMessenger, "Bridge: invalid signature!");

            nonces[nonce] = true;
    }

    /// @dev Generates the digest that is used in signature verification for native tokens
    /// @param receiver The receiver of transfered tokens
    /// @param amount The amount of tokens to be transfered
    /// @param nonce Unique number to prevent replay
    function getPermitDigestNative(
        address receiver,
        uint256 amount,
        uint256 nonce
    ) internal view returns (bytes32) {
        bytes32 domainSeparator = getDomainSeparatorNative("1", block.chainid, address(this));
        bytes32 typeHash = getPermitTypeHashNative(receiver, amount, nonce);

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
    ) internal view returns (bytes32) {
            
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
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
    /// @param receiver The receiver of transfered tokens
    /// @param amount The amount of tokens to be transfered
    /// @param nonce Unique number to prevent replay
    function getPermitTypeHashNative(
        address receiver,
        uint256 amount,
        uint256 nonce
    ) internal pure returns (bytes32) {

        bytes32 permitHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address spender,uint256 value,uint256 nonce)"
                ),
                receiver,
                amount,
                nonce
            )
        );

        return permitHash;
    }

    //==========ERC20 Signatures==========

    /// @dev Verifies that a signature of PERMIT_DIGEST for ERC20 tokens is valid 
    /// @param nonce Prevent replay attacks
    /// @param amount The amount of tokens of the digest
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @param token The address of transfered token
    /// @param msgSender The address of account on another chain
    function signatureVerificationERC20(
        uint256 nonce,
        uint256 amount,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address token,
        address msgSender
    ) internal {
            require(!nonces[nonce], "Bridge: request already processed!");

            bytes32 permitDigest = getPermitDigestERC20(
                token,
                msgSender,
                amount,
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
    /// @param receiver The receiver of transfered tokens
    /// @param amount The amount of tokens to be transfered
    /// @param nonce Unique number to prevent replay
    function getPermitDigestERC20(
        address token,
        address receiver,
        uint256 amount,
        uint256 nonce
    ) internal view returns (bytes32) {
        bytes32 domainSeparator = getDomainSeparatorERC20(token, "1", block.chainid, address(this));
        bytes32 typeHash = getPermitTypeHashERC20(receiver, amount, nonce);

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
    /// @param _token The address of the token to be transfered
    /// @param version The version of separator
    /// @param chainId The ID of the current chain
    /// @param verifyingAddress The address of the contract that will verify the signature
    function getDomainSeparatorERC20(
        address _token,
        string memory version,
        uint256 chainId, 
        address verifyingAddress
    ) internal view returns (bytes32) {

        IWrappedERC20 token = IWrappedERC20(_token);
        
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                // Token name
                keccak256(bytes(token.name())),
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
    /// @param receiver The receiver of transfered tokens
    /// @param amount The amount of tokens to be transfered
    /// @param nonce Unique number to prevent replay
    function getPermitTypeHashERC20(
        address receiver,
        uint256 amount,
        uint256 nonce
    ) internal pure returns (bytes32) {

        bytes32 permitHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address spender,uint256 value,uint256 nonce)"
                ),
                receiver,
                amount,
                nonce
            )
        );

        return permitHash;
    }

    //==========ERC721 Signatures==========

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
                msgSender,
                tokenId,
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
    /// @param receiver The receiver of transfered tokens
    /// @param tokenId The ID of the transfered token
    /// @param nonce Unique number to prevent replay
    function getPermitDigestERC721(
        address token,
        address receiver,
        uint256 tokenId,
        uint256 nonce
    ) internal view returns (bytes32) {
        bytes32 domainSeparator = getDomainSeparatorERC721(token, "1", block.chainid, address(this));
        bytes32 typeHash = getPermitTypeHashERC721(receiver, tokenId, nonce);

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
    /// @param _token The address of the token to be transfered
    /// @param version The version of separator
    /// @param chainId The ID of the current chain
    /// @param verifyingAddress The address of the contract that will verify the signature
    function getDomainSeparatorERC721(
        address _token,
        string memory version,
        uint256 chainId, 
        address verifyingAddress
    ) internal view returns (bytes32) {

        IWrappedERC721 token = IWrappedERC721(_token);
        
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                // Token name
                keccak256(bytes(token.name())),
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
    /// @param receiver The receiver of transfered token
    /// @param tokenId The ID of transfered token
    /// @param nonce Unique number to prevent replay
    function getPermitTypeHashERC721(
        address receiver,
        uint256 tokenId,
        uint256 nonce
    ) internal pure returns (bytes32) {

        bytes32 permitHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address spender,uint256 value,uint256 nonce)"
                ),
                receiver,
                tokenId,
                nonce
            )
        );

        return permitHash;
    }


   //==========ERC1155 Signatures==========

    /// @dev Verifies that a signature of PERMIT_DIGEST for ERC1155 tokens is valid 
    /// @param nonce Prevent replay attacks
    /// @param tokenId The ID of transfered token
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @param msgSender The address of account on another chain
    function signatureVerificationERC1155(
        uint256 nonce,
        uint256 tokenId,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address amount,
        address msgSender
    ) internal {
            require(!nonces[nonce], "Bridge: request already processed!");

            bytes32 permitDigest = getPermitDigestERC1155(
                amount,
                msgSender,
                tokenId,
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
    /// @param receiver The receiver of transfered tokens
    /// @param tokenId The ID of the transfered token
    /// @param nonce Unique number to prevent replay
    function getPermitDigestERC1155(
        address amount,
        address receiver,
        uint256 tokenId,
        uint256 nonce
    ) internal view returns (bytes32) {
        bytes32 domainSeparator = getDomainSeparatorERC1155("1", block.chainid, address(this));
        bytes32 typeHash = getPermitTypeHashERC1155(receiver, amount, nonce);

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
    /// @param _token The address of the token to be transfered
    /// @param version The version of separator
    /// @param chainId The ID of the current chain
    /// @param verifyingAddress The address of the contract that will verify the signature
    function getDomainSeparatorERC1155(
        address _token,
        string memory version,
        uint256 chainId, 
        address verifyingAddress
    ) internal view returns (bytes32) {

        IWrappedERC1155 token = IWrappedERC1155(_token);
        
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                // Token name
                keccak256(bytes(token.name())),
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
    /// @param receiver The receiver of transfered token
    /// @param amount The amount of tokens of specific type
    /// @param nonce Unique number to prevent replay
    function getPermitTypeHashERC1155(
        address receiver,
        uint256 amount,
        uint256 nonce
    ) internal pure returns (bytes32) {

        bytes32 permitHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address spender,uint256 value,uint256 nonce)"
                ),
                receiver,
                amount,
                nonce
            )
        );

        return permitHash;
    }
}
