// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./interfaces/IBridge.sol";
import "./interfaces/IWrappedERC20Template.sol";
import "./WrappedERC20Template.sol";

import "hardhat/console.sol";

/// @title A ERC20-ERC20 bridge contract
contract Bridge is IBridge, AccessControl {

    using SafeERC20 for IERC20;
    using SafeERC20 for IWrappedERC20Template;

    IWrappedERC20Template public wrappedToken;

    ///@dev Names of supported chains
    mapping(string => bool) public supportedChains;
    ///@dev Monitor fees
    mapping(address => uint) public feeTokenAndAmount;
    ///@dev Monitor nonces. Prevent replay attacks
    mapping(uint256 => bool) public nonces;

    bytes32 public constant BOT_MESSENGER_ROLE = keccak256("BOT_MESSENGER_ROLE");
    address public botMessenger;

    /// @dev Maximum amount of basis points. Used to calculate final fee.
    uint private constant MAX_BP = 1000;
    /// @dev Fee rate. Used to calculate final fee. May be changed. 0.3 - 3%
    uint public feeRate; 

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

    /// @dev Checks if address is not a zero address
    modifier notZeroAddress(address _address) {
        require(_address != address(0), "Bridge: the address is a zero address!");
        _;
    }

    /// @dev Checks the contracts is supported on the given chain
    modifier isSupportedChain(string memory chain) {
        require(supportedChains[chain], "Bridge: the chain is not supported!");
        _;
    }

    /// @notice Initializes internal variables, sets roles
    /// @param _wrappedToken The address of the modified ERC20 token
    /// @param _botMessenger The address of bot messenger
    /// @param _feeRate The fee rate in basis points
    constructor(
        address _wrappedToken,
        address _botMessenger,
        uint _feeRate
    ) { 
        // The caller becomes an admin
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // The provided address gets a special role (used in signature verification)
        _setupRole(BOT_MESSENGER_ROLE, botMessenger);
        botMessenger = _botMessenger;

        feeRate = _feeRate;

        // Create a modified ERC20 token to be used across the bridge
        if (_wrappedToken != address(0)) {
            wrappedToken = IWrappedERC20Template(_wrappedToken);
        }

    }


    /// @notice Locks tokens on the source chain
    /// @param token Address of the token to lock
    /// @param amount The amount of tokens to lock
    /// @param targetChain The name of the target chain
    /// @return True if tokens were locked successfully
    function lock(
        address token,
        uint256 amount,
        string memory targetChain
    )
    external
    payable
    override
    isSupportedChain(targetChain)
    returns(bool)
    {
        address sender = msg.sender;

        if (token != address(0)){
            // Calculate the fee and save it
            uint feeAmount = calcFee(amount);
            feeTokenAndAmount[token] += feeAmount;

            // NOTE ERC20.approve(sender, address(this), amount + feeAmount) must be called on the frontend 
            // before transfering the tokens

            // After this transfer all tokens are in possesion of the bridge contract and they can not be
            // withdrawn by explicitly calling `ERC20.safeTransferFrom` of `ERC20.transferFrom` because the bridge contract
            // does not provide allowance of these tokens for anyone. The only way to transfer tokens from the
            // bridge contract to some other address is to call `ERC20.safeTransfer` inside the contract itself.
            // Thus, transfered tokens are locked inside the bridge contract
            // Transfer additional fee with the initial amount of tokens
            IWrappedERC20Template(token).safeTransferFrom(sender, address(this), amount + feeAmount);

            // Emit the lock event with detailed information
            emit Lock(token, sender, amount, targetChain);

            return true;

        } else {

            // If the user tried to lock the zero address, then only fees are payed
            require(msg.value != 0, "Bridge: no tokens were sent with transaction!");

            // No tokens are transfered in this case
            uint feeAmount = calcFee(msg.value);
            feeTokenAndAmount[token] += feeAmount;

            // The lock event is still emitted
            emit Lock(token, sender, msg.value - feeAmount, targetChain);

            return true;
        }
    }


    /// @notice Burns tokens on a target chain
    /// @param token Address of the token to burn
    /// @param amount The amount of tokens to burn
    /// @param targetChain The name of the target chain
    /// @return True if tokens were burnt successfully
    function burn(
        address token,
        uint256 amount,
        string memory targetChain
    )
    external
    override
    notZeroAddress(token)
    isSupportedChain(targetChain)
    returns(bool)
    {
        address sender = msg.sender;
        // Calculate the fee and save it
        uint feeAmount = calcFee(amount);
        feeTokenAndAmount[token] += feeAmount;

        // NOTE ERC20.approve(sender, address(this), amount + feeAmount) must be called on the frontend 
        // before transfering the tokens

        // Transfer user's tokens (and a fee) to the bridge contract and burn them immediately
        IWrappedERC20Template(token).safeTransferFrom(sender, address(this), amount + feeAmount);
        // Burn all tokens except the fee
        IWrappedERC20Template(token).burn(address(this), amount);

        emit Burn(token, sender, amount, targetChain);

        return true;
    }


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
    )
    external
    override
    notZeroAddress(token)
    returns(bool)
    {   
        address sender = msg.sender;

        // Verify the signature (contains v, r, s) using the domain separator
        // This will prove that the user has locked tokens on the source chain
        signatureVerification(nonce, amount, v, r, s, token, sender);
        // Mint wrapped tokens on the other chain 
        IWrappedERC20Template(token).mint(sender, amount);

        emit MintWithPermit(token, sender, amount);

        return true;
    }

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
    )
    external
    override
    returns(bool)
    {
        address sender = msg.sender;

        // Verify the signature (contains v, r, s) using the domain separator
        // This will prove that the user has burnt tokens on the target chain
        signatureVerification(nonce, amount, v, r, s, token, sender);

        require(
            IWrappedERC20Template(token).balanceOf(address(this)) >= feeTokenAndAmount[token] + amount,
            "Bridge: Not enough tokens to unlock!"
        );

        // This is the only way to withdraw locked tokens from the bridge contract
        // (see `lock` method of this contract)
        IWrappedERC20Template(token).safeTransfer(sender, amount);

        emit UnlockWithPermit(token, sender, amount);

        return true;

    }

    /// @notice Sets the modified ERC20 token used in the bridge
    /// @param newWrappedToken Address of the token
    function setBridgedStandardERC20(
        address newWrappedToken
    )
    external
    onlyAdmin
    notZeroAddress(newWrappedToken)
    {
        wrappedToken = IWrappedERC20Template(newWrappedToken);
    }

    /// @notice Sets the admin
    /// @param newAdmin Address of the admin   
    function setAdmin(address newAdmin) external onlyAdmin {
        grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
    }

    /// @notice Sets a new fee rate for bridge operations
    /// @param newFeeRate A new rate in basis points
    function setFeeRate(uint newFeeRate) external onlyAdmin {
        require(newFeeRate > 0 && newFeeRate <= MAX_BP, "Bridge: fee rate is too high!");
        feeRate = newFeeRate;
    }

    /// @notice Calculates a fee for bridge operations
    /// @param amount An amount of tokens that were sent. The more tokens - the higher the fee
    /// @return The fee amount
    function calcFee(uint amount) private view returns(uint) {
        return amount * feeRate / MAX_BP;
    }


    /// @notice Withdraws fees accumulated from a specific token operations
    /// @param token The address of the token that was used in the operations 
    /// @param amount The amount of fees from a single token to be withdrawn
    function withdraw(address token, uint amount) external onlyAdmin {
        require(feeTokenAndAmount[token] != 0, "Bridge: no fees were collected for this token!");
        require(feeTokenAndAmount[token] >= amount, "Bridge: amount of fees to withdraw is too large!");
        
        feeTokenAndAmount[token] -= amount;
        
        if (token != address(0)) {
            // Send custom ERC20 tokens
            IWrappedERC20Template(token).safeTransfer(msg.sender, amount);
        } else {
            // Or send native tokens
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

    /// @dev One of the nested functions for signature verification
    function getPermitDigest(
        address token,
        address receiverAddress,
        uint256 amount,
        uint256 nonce
    ) internal view returns (bytes32) {
        bytes32 domainSeparator = getDomainSeparator(token, "1", block.chainid, address(this));
        bytes32 typeHash = getPermitTypeHash(receiverAddress, amount, nonce);

        bytes32 permitDigest = keccak256(
            abi.encodePacked(
                uint16(0x1901),
                domainSeparator,
                typeHash
            )
        );

        return permitDigest;
    }

    /// @dev Calculates DOMAIN_SEPARATOR of the token
    function getDomainSeparator(
        address _token,
        string memory version,
        uint256 chainid, 
        address verifyingAddress
    ) internal view returns (bytes32) {
        require(_token != address(0), "Bridge: invalid address of transfered token!");

        WrappedERC20Template token = WrappedERC20Template(_token);
        
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainid,address verifyingContract)"
                ),
                // Token name
                keccak256(bytes(token.name())),
                // Version
                keccak256(bytes(version)),
                // ChainID
                chainid,
                // Verifying contract
                verifyingAddress
            )
        );

        return domainSeparator;
    }


    /// @dev One of the nested functions for signature verification
    function getPermitTypeHash(
        address to,
        uint256 amount,
        uint256 nonce
    ) internal pure returns (bytes32) {

        bytes32 permitHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address spender,uint256 value,uint256 nonce)"
                ),
                to,
                amount,
                nonce
            )
        );

        return permitHash;
    }

}
