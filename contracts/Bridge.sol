// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./interfaces/IBridge.sol";
import "./interfaces/IBridgeTokenStandardERC20.sol";

import "hardhat/console.sol";

/// @title A ERC20-ERC20 bridge contract
contract Bridge is IBridge, AccessControl {

    using SafeERC20 for IERC20;
    using SafeERC20 for IBridgeTokenStandardERC20;

    IBridgeTokenStandardERC20 public bridgeStandardERC20;

    ///@dev [token address -> domainSeparator] map
    mapping(address => bytes32) public allowedTokens;
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
    /// @dev Monitor tokens that are to be unwrapped back into source chain
    /// TODO it is never used!
    struct TokenInfo {
        /// @dev The name of the source chain
        string originalChain; 
        /// @dev The address of the token in the source chain
        string originalTokenAddress;
        /// @dev The address of the wrapped token in the target chain
        address wrappedTokenAddress; 
    }

    TokenInfo[] public tokenInfos;


    /// @dev Checks if caller is a messenger bot
    modifier onlyMessengerBot {
        require(hasRole(BOT_MESSENGER_ROLE, _msgSender()), "Bridge: the caller is not a messenger bot!");
        _;
    }

    /// @dev Checks if caller is an admin
    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Bridge: the caller is not an admin!");
        _;
    }

    /// @dev Checks if address is not a zero address
    modifier notZeroAddress(address _address) {
        require(_address != address(0), "Bridge: the address is a zero address!");
        _;
    }

    /// @dev Checks if tokens is allowes to be minted
    modifier tokenIsAllowed(address _token) {
        require(allowedTokens[_token] != 0, "Bridge: the token is not allowed!");
        _;
    }

    /// @dev Checks the contracts is supported on the given chain
    modifier isSupportedChain(string memory _chain) {
        require(supportedChains[_chain], "Bridge: the chain is not supported!");
        _;
    }

    /// @notice Initializes internal variables, sets roles
    /// @param _bridgeStandardERC20 The address of the modified ERC20 token
    /// @param _botMessenger The address of bot messenger
    /// @param _feeRate The fee rate in basis points
    constructor(
        address _bridgeStandardERC20,
        address _botMessenger,
        uint _feeRate
    ) { 
        // The caller becomes an admin
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        // The provided address gets a special role (used in signature verification)
        _setupRole(BOT_MESSENGER_ROLE, _botMessenger);
        botMessenger = _botMessenger;

        feeRate = _feeRate;

        // Create a modified ERC20 token to be used across the bridge
        if (_bridgeStandardERC20 != address(0)) {
            bridgeStandardERC20 = IBridgeTokenStandardERC20(_bridgeStandardERC20);
        }

    }


    /// @notice Locks tokens on the source chain
    /// @param token Address of the token to lock
    /// @param amount The amount of tokens to lock
    /// @param targetChain The name of the target chain
    /// @return True if tokens were locked successfully
    function lock(
        address _token,
        uint256 _amount,
        string memory _targetChain
    )
    external
    payable
    override
    tokenIsAllowed(_token)
    isSupportedChain(_targetChain)
    returns(bool)
    {
        address sender = _msgSender();

        if (_token != address(0)){
            // Calculate the fee and save it
            uint feeAmount = _calcFee(_amount);
            feeTokenAndAmount[_token] += feeAmount;

            // NOTE ERC20.approve(sender, address(this), _amount + feeAmount) must be called on the frontend 
            // before transfering the tokens

            // After this transfer all tokens are in possesion of the bridge contract and they can not be
            // withdrawn by explicitly calling `ERC20.safeTransferFrom` of `ERC20.transferFrom` because the bridge contract
            // does not provide allowance of these tokens for anyone. The only way to transfer tokens from the
            // bridge contract to some other address is to call `ERC20.safeTransfer` inside the contract itself.
            // Thus, transfered tokens are locked inside the bridge contract
            // Transfer additional fee with the initial amount of tokens
            IBridgeTokenStandardERC20(_token).safeTransferFrom(sender, address(this), _amount + feeAmount);

            // Emit the lock event with detailed information
            emit Lock(_token, sender, _amount, _targetChain);

            return true;

        } else {

            // If the user tried to lock the zero address, then only fees are payed
            require(msg.value != 0, "Bridge: no tokens were sent with transaction!");

            // No tokens are transfered in this case
            uint feeAmount = _calcFee(msg.value);
            feeTokenAndAmount[_token] += feeAmount;

            // The lock event is still emitted
            emit Lock(_token, sender, msg.value - feeAmount, _targetChain);

            return true;
        }
    }


    /// @notice Burns tokens on a target chain
    /// @param token Address of the token to burn
    /// @param to Address of the wallet in the source chain
    /// @param amount The amount of tokens to burn
    /// @param targetChain The name of the target chain
    /// @return True if tokens were burnt successfully
    function burn(
        address _token,
        string memory _receiverAddress,
        uint256 _amount,
        string memory _targetChain
    )
    external
    override
    notZeroAddress(_token)
    tokenIsAllowed(_token)
    isSupportedChain(_targetChain)
    returns(bool)
    {
        address sender = _msgSender();
        // Calculate the fee and save it
        uint feeAmount = _calcFee(_amount);
        feeTokenAndAmount[_token] += feeAmount;

        // NOTE ERC20.approve(sender, address(this), _amount + feeAmount) must be called on the frontend 
        // before transfering the tokens

        // Transfer user's tokens (and a fee) to the bridge contract and burn them immediately
        IBridgeTokenStandardERC20(_token).safeTransferFrom(sender, address(this), _amount + feeAmount);
        // Burn all tokens except the fee
        IBridgeTokenStandardERC20(_token).burn(address(this), _amount);

        return true;
    }


    /// @notice Mints tokens if the user is permitted to mint
    /// @param _token Address of the token to mint
    /// @param _amount The amount of tokens to mint
    /// @param _nonce Prevent replay attacks
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @return True if tokens were minted successfully
    function mintWithPermit(
        address _token,
        uint256 _amount,
        uint256 _nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
    external
    override
    notZeroAddress(_token)
    tokenIsAllowed(_token)
    returns(bool)
    {   
        address sender = _msgSender();
        // Get the domain separator of the token
        bytes32 domainSeparator = allowedTokens[_token];

        // Verify the signature (contains v, r, s) using the domain separator
        signatureVerification(_nonce, _amount, v, r, s, domainSeparator, sender);
        // If the signature was verified - mint the required amount of tokens
        IBridgeTokenStandardERC20(_token).mint(sender, _amount);

        emit MintWithPermit(_token, sender, _amount);

        return true;
    }

    /// @notice Unlocks tokens if the user is permitted to unlock
    /// @param _token Address of the token to unlock
    /// @param _amount The amount of tokens to unlock
    /// @param _nonce Prevent replay attacks
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @return True if tokens were unlocked successfully
    function unlockWithPermit(
        address _token,
        uint256 _amount,
        uint256 _nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
    external
    override
    tokenIsAllowed(_token)
    returns(bool)
    {
        address sender = _msgSender();
        if (_token != address(0)) {
            
            // Get the domain separator of the token
            bytes32 domainSeparator = allowedTokens[_token];
            // Verify the signature (contains v, r, s) using the domain separator
            signatureVerification(_nonce, _amount, v, r, s, domainSeparator, sender);

            require(
                IERC20(_token).balanceOf(address(this)) >= feeTokenAndAmount[_token] + _amount,
                "Bridge: Not enough tokens to unlock!"
            );

            // This is the only way to withdraw locked tokens from the bridge contract
            // (see `lock` method)
            IERC20(_token).safeTransfer(sender, _amount);

            emit UnlockWithPermit(_token, sender, _amount);

            return true;

        } else {

            // Get the domain separator of the token
            bytes32 domainSeparator = allowedTokens[_token];
            // Verify the signature (contains v, r, s) using the domain separator
            signatureVerification(_nonce, _amount, v, r, s, domainSeparator, sender);

            // If the user locked tokens with the zero address then native tokens are minted 
            // to the user after unlock
            require(
                address(this).balance >= feeTokenAndAmount[_token] + _amount,
                "Bridge: Not enough tokens to unlock!"
            );

            (bool success, ) = sender.call{ value: _amount }("");

            emit UnlockWithPermit(_token, sender, _amount);

            return true;
        }
    }

    /// @notice Sets the modified ERC20 token used in the bridge
    /// @param _bridgeStandardERC20 Address of the token
    function setBridgedStandardERC20(
        address _bridgeStandardERC20
    )
    external
    onlyAdmin
    notZeroAddress(_bridgeStandardERC20)
    {
        bridgeStandardERC20 = IBridgeTokenStandardERC20(_bridgeStandardERC20);
    }

    /// @notice Sets the admin
    /// @param _newAdmin Address of the admin   
    function setAdmin(address _newAdmin) external onlyAdmin {
        grantRole(DEFAULT_ADMIN_ROLE, _newAdmin);
    }

    /// @notice Sets domain separator for an allowed token
    /// @param _token Address of the token used in the bridge (0 for native token of the chain)
    /// @param name Name of the token used in the bridge (name of the native token of the chain)
    function setAllowedToken(
        address _token,
        string memory _name
    )
    external
    onlyAdmin
    {
        bytes32 domainSeparator;
        if (_token != address(0)) {
            // A custom ERC20 token
            ERC20 token = ERC20(_token);
            
            domainSeparator = keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    // Token name
                    keccak256(bytes(token.name())),
                    // Version
                    keccak256(bytes("1")),
                    // ChainID
                    block.chainid,
                    // Verifying contract
                    address(this)
                )
            );
        } else {
            // A native token of the chain
            require(bytes(_name).length != 0, "Bridge: Token name is empty!");
            domainSeparator = keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    // Token name
                    keccak256(bytes(_name)),
                    // Version
                    keccak256(bytes("1")),
                    // ChainID
                    block.chainid,
                    // Verifying contract
                    address(this)
                )
            );
        }
        allowedTokens[_token] = domainSeparator;
    }


    /// @notice Forbids the token to be used in the bridge
    /// @param _token Address of the token to forbid
    function removeAllowedToken(address _token) external onlyAdmin {
        allowedTokens[_token] = 0;
    }

    /// @notice Sets a new fee rate for bridge operations
    /// @param _feeRate A new rate in basis points
    function setFeeRate(uint _feeRate) external onlyAdmin {
        require(_feeRate > 0 && _feeRate <= MAX_BP, "Bridge: fee rate it too high!");
        feeRate = _feeRate;
    }

    /// @notice Calculates a fee for bridge operations
    /// @param _amount An amount of tokens that were sent. The more tokens - the higher the fee
    /// @return The fee amount
    function _calcFee(uint _amount) private view returns(uint) {
        return _amount * feeRate / MAX_BP;
    }


    /// @notice Withdraws fees accumulated from a specific token operations
    /// @param _token The address of the token that was used in the operations 
    /// @param _amount The amount of fees from a single token to be withdrawn
    function withdraw(address _token, uint _amount) external onlyAdmin {
        require(feeTokenAndAmount[_token] != 0, "Bridge: no fees were collected for this token!");
        require(feeTokenAndAmount[_token] >= _amount, "Bridge: amount of fees to withdraw is too large!");
        
        feeTokenAndAmount[_token] -= _amount;
        
        if (_token != address(0)) {
            // Send custom ERC20 tokens
            IERC20(_token).safeTransfer(_msgSender(), _amount);
        } else {
            // Or send native tokens
            (bool success, ) = _msgSender().call{ value: _amount }("");
        }

    }

    /// @notice Adds a chain supported by the bridge
    /// @param _chain The name of the chain
    function setSupportedChain(string memory _chain) external onlyAdmin {
        supportedChains[_chain] = true;
    }

    /// @notice Removes a chain supported by the bridge
    /// @param _chain The name of the chain
    function removeSupportedChain(string memory _chain) external onlyAdmin {
        supportedChains[_chain] = false;
    }

    /// @dev Verifies that a signature of PERMIT_DIGEST is valid
    /// @param _nonce Prevent replay attacks
    /// @param _amount The amount of tokens if the digest
    /// @param v Last byte of the signed PERMIT_DIGEST
    /// @param r First 32 bytes of the signed PERMIT_DIGEST
    /// @param v 32-64 bytes of the signed PERMIT_DIGEST
    /// @param _domainSeparator The domain seperator of the token
    /// @param _msgSender The address of account on another chain
    function signatureVerification(
        uint256 _nonce,
        uint256 _amount,
        uint8 v,
        bytes32 r,
        bytes32 s,
        bytes32 _domainSeparator,
        address _msgSender
    ) internal {
            require(!nonces[_nonce], "Bridge: request already processed!");

            bytes32 permitDigest = getPermitDigest(
                _domainSeparator,
                _msgSender,
                _amount,
                _nonce
            );

            // Recover the signer of the PERMIT_DIGEST
            address signer = ecrecover(permitDigest, v, r, s);
            // Compare the recover and the required signer
            require(signer == botMessenger, "Bridge: invalid signature!");

            nonces[_nonce] = true;
    }

    /// @dev One of the nested functions for signature verification
    function getPermitDigest(
        bytes32 _domainSeparator,
        address _receiverAddress,
        uint256 _amount,
        uint256 _nonce
    ) internal pure returns (bytes32) {
        return
        keccak256(
            abi.encodePacked(
                uint16(0x1901),
                _domainSeparator,
                getPermitTypeHash(_receiverAddress, _amount, _nonce)
            )
        );
    }

    /// @dev One of the nested functions for signature verification
    function getPermitTypeHash(
        address _to,
        uint256 _amount,
        uint256 _nonce
    ) internal pure returns (bytes32) {
        return 
        keccak256(
            abi.encode(
                keccak256(
                    "Permit(address spender,uint256 value,uint256 nonce)"
                ),
                _to,
                _amount,
                _nonce
            )
        );
    }

}
