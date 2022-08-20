// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./interfaces/IBridge.sol";
import "./interfaces/IWrappedERC20.sol";
import "./WrappedERC20.sol";

import "hardhat/console.sol";

/// @title A ERC20-ERC20 bridge contract
contract Bridge is IBridge, AccessControl, ReentrancyGuard {

    using SafeERC20 for IERC20;
    using SafeERC20 for IWrappedERC20;

    ///@dev Names of supported chains
    mapping(string => bool) public supportedChains;
    ///@dev Monitor fees
    mapping(address => uint256) public feesForToken;
    ///@dev Monitor nonces. Prevent replay attacks
    mapping(uint256 => bool) public nonces;

    bytes32 public constant BOT_MESSENGER_ROLE = keccak256("BOT_MESSENGER_ROLE");
    address public botMessenger;

    /// @dev Maximum amount of basis points. Used to calculate final fee.
    uint256 private constant MAX_BP = 1000;
    /// @dev Fee rate. Used to calculate final fee. May be changed. 0.3 - 3%
    uint256 public feeRate; 

    /// @dev Checks if caller is a messenger bot
    modifier onlyMessengerBot {
        require(hasRole(BOT_MESSENGER_ROLE, msg.sender), "Bridge: the caller is not a messenger bot!");
        _;
    }

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
    /// @param _feeRate The fee rate in basis points
    constructor(
        address _botMessenger,
        uint256 _feeRate
    ) { 
        // The caller becomes an admin
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // The provided address gets a special role (used in signature verification)
        botMessenger = _botMessenger;
        _setupRole(BOT_MESSENGER_ROLE, botMessenger);

        feeRate = _feeRate;

    }


    /// @notice Locks tokens on the source chain
    /// @param token Address of the token to lock (zero address for native tokens)
    /// @param amount The amount of tokens to lock
    /// @param receiver The receiver of wrapped tokens on the target chain (not only EVM)
    /// @param targetChain The name of the target chain
    /// @return True if tokens were locked successfully
    function lock(
        address token,
        uint256 amount,
        string memory receiver,
        string memory targetChain
    )
    external
    // If a user wants to lock native tokens - he should provide `amount+fee` native tokens
    // The fee can be calculated using `calcFee` method (only by the admin)
    payable
    override
    isSupportedChain(targetChain)
    nonReentrant
    returns(bool)
    {
        address sender = msg.sender;

        // Calculate the fee and save it
        uint256 feeAmount = calcFee(amount);
        feesForToken[token] += feeAmount;

        // Custom tokens
        if (token != address(0)){
     
            // NOTE ERC20.increaseAllowance(address(this), amount + feeAmount) must be called on the frontend 
            // before transfering the tokens

            // After this transfer all tokens are in possesion of the bridge contract and they can not be
            // withdrawn by explicitly calling `ERC20.safeTransferFrom` of `ERC20.transferFrom` because the bridge contract
            // does not provide allowance of these tokens for anyone. The only way to transfer tokens from the
            // bridge contract to some other address is to call `ERC20.safeTransfer` inside the contract itself.
            // Thus, transfered tokens are locked inside the bridge contract
            // Transfer additional fee with the initial amount of tokens
            IWrappedERC20(token).safeTransferFrom(sender, address(this), amount + feeAmount);

            // Emit the lock event with detailed information
            emit Lock(token, sender, receiver, amount, targetChain);

            return true;

        // Native tokens
        } else {

            // User provides some native tokens to the bridge when calling this `lock` method so no
            // need to transfer any tokens here once more
            // Make sure that he sent enought tokens to cover both amount and fee
            require(msg.value >= amount + feeAmount, "Bridge: not enough tokens to cover the fee!");

            emit Lock(token, sender, receiver, amount, targetChain);

            return true;
        }

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
    override
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
        feesForToken[token] += feeAmount;

        // NOTE ERC20.increaseAllowance(address(this), amount + feeAmount) must be called on the frontend 
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
    override
    nonReentrant
    returns(bool)
    {   
        // Only WrappedERC20 tokens can be minted on the target chain. 
        // Native tokens of target chain can not be an equivalent of any tokens of the original chain
        address sender = msg.sender;

        // Verify the signature (contains v, r, s) using the domain separator
        // This will prove that the user has locked tokens on the source chain
        signatureVerification(nonce, amount, v, r, s, token, sender);
        // Mint wrapped tokens to the user's address on the target chain
        // NOTE This method should be called from the address on the target chain 
        IWrappedERC20(token).mint(sender, amount);

        emit MintWithPermit(token, sender, amount);

        return true;
    }

    /// @notice Unlocks tokens if the user is permitted to unlock
    /// @param token Address of the token to unlock (zero address for native tokens)
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
    )
    external
    override
    nonReentrant
    returns(bool)
    {
        address sender = msg.sender;

        // Custom tokens
        if (token != address(0)){
            // Check if there is enough custom tokens on the bridge (no fees)
            require(
                IWrappedERC20(token).balanceOf(address(this)) >= amount,
                "Bridge: not enough ERC20 tokens on the bridge balance!"
            );


            // Verify the signature (contains v, r, s) using the domain separator
            // This will prove that the user has burnt tokens on the target chain
            signatureVerification(nonce, amount, v, r, s, token, sender);

            // This is the only way to withdraw locked tokens from the bridge contract
            // (see `lock` method of this contract)
            IWrappedERC20(token).safeTransfer(sender, amount);

            emit UnlockWithPermit(token, sender, amount);

            return true;

        // Native tokens
        } else {

            // Check if there is enough native tokens on the bridge (no fees)
            require(
                address(this).balance >= amount,
                "Bridge: not enough native tokens on the bridge balance!"
            );

            // Verify the signature (contains v, r, s) using the domain separator
            // This will prove that the user has burnt tokens on the target chain
            signatureVerification(nonce, amount, v, r, s, token, sender);

            // Transfer native tokens of the original chain from the bridge to the caller
            (bool success, ) = sender.call{ value: amount }("");
            require(success, "Bridge: tokens unlock failed!");

            emit UnlockWithPermit(token, sender, amount);

            return true;

        }    
        
    }

    /// @notice Sets the admin
    /// @param newAdmin Address of the admin   
    function setAdmin(address newAdmin) external onlyAdmin {
        grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
    }

    /// @notice Sets a new fee rate for bridge operations
    /// @param newFeeRate A new rate in basis points
    function setFeeRate(uint256 newFeeRate) external onlyAdmin {
        require(newFeeRate > 0 && newFeeRate <= MAX_BP, "Bridge: fee rate is too high!");
        feeRate = newFeeRate;
    }

    /// @notice Calculates a fee for bridge operations
    /// @param amount An amount of tokens that were sent. The more tokens - the higher the fee
    /// @return The fee amount
    function calcFee(uint256 amount) public view returns(uint256) {
        return amount * feeRate / MAX_BP;
    }


    /// @notice Withdraws fees accumulated from a specific token operations
    /// @param token The address of the token (zero address for native token)
    /// @param amount The amount of fees from a single token to be withdrawn
    function withdraw(address token, uint256 amount) external nonReentrant onlyAdmin {
        require(feesForToken[token] != 0, "Bridge: no fees were collected for this token!");
        require(feesForToken[token] >= amount, "Bridge: amount of fees to withdraw is too large!");
        
        feesForToken[token] -= amount;
        
        // Custom token
        if (token != address(0)) {
            IWrappedERC20(token).safeTransfer(msg.sender, amount);
        // Native token
        } else {
            (bool success, ) = msg.sender.call{ value: amount }("");
            require(success, "Bridge: tokens withdrawal failed!");
        }

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

    /// @dev Verifies that a signature of PERMIT_DIGEST is valid
    /// @param nonce Prevent replay attacks
    /// @param amount The amount of tokens if the digest
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @param msgSender The address of account on another chain
    function signatureVerification(
        uint256 nonce,
        uint256 amount,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address token,
        address msgSender
    ) internal {
            require(!nonces[nonce], "Bridge: request already processed!");

            bytes32 permitDigest = getPermitDigest(
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

    /// @dev Generates the digest that is used in signature verification
    /// @param token The address of the token to be transfered
    /// @param receiver The receiver of transfered tokens
    /// @param amount The amount of tokens to be transfered
    /// @param nonce Unique number to prevent replay
    function getPermitDigest(
        address token,
        address receiver,
        uint256 amount,
        uint256 nonce
    ) internal view returns (bytes32) {
        bytes32 domainSeparator = getDomainSeparator(token, "1", block.chainid, address(this));
        bytes32 typeHash = getPermitTypeHash(receiver, amount, nonce);

        bytes32 permitDigest = keccak256(
            abi.encodePacked(
                uint16(0x1901),
                domainSeparator,
                typeHash
            )
        );

        return permitDigest;
    }

    /// @dev Generates domain separator of the token
    /// @dev Used to generate permit digest afterwards
    /// @param _token The address of the token to be transfered
    /// @param version The version of separator
    /// @param chainId The ID of the current chain
    /// @param verifyingAddress The address of the contract that will verify the signature
    function getDomainSeparator(
        address _token,
        string memory version,
        uint256 chainId, 
        address verifyingAddress
    ) internal view returns (bytes32) {
        require(_token != address(0), "Bridge: invalid address of transfered token!");

        WrappedERC20 token = WrappedERC20(_token);
        
        bytes32 domainSeparator = keccak256(
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

        return domainSeparator;
    }


    /// @dev Generates the type hash for permit digest
    /// @param receiver The receiver of transfered tokens
    /// @param amount The amount of tokens to be transfered
    /// @param nonce Unique number to prevent replay
    function getPermitTypeHash(
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
