pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./interfaces/IBridge.sol";
import "./interfaces/IBridgeTokenStandardERC20.sol";

import "hardhat/console.sol";

contract Bridge is IBridge, AccessControl {

    using SafeERC20 for IERC20;
    using SafeERC20 for IBridgeTokenStandardERC20;

    IBridgeTokenStandardERC20 public bridgeStandardERC20;
    // token address -> domainSeparator
    mapping(address => bytes32) public allowedTokens;
    mapping(string => bool) public supportedChains;
    //отслеживаем комиссии
    mapping(address => uint) public feeTokenAndAmount;

    mapping(uint256 => bool) public nonces;
//    bytes32 public immutable domainSeparatorForNativeToken;

    bytes32 public constant BOT_MESSENGER_ROLE = keccak256("BOT_MESSENGER_ROLE");
    address public botMessenger;

    uint private constant MAX_BP = 1000;
    uint public feeRate; // 3 - 0.3%
    // для отслеживания токенов, которые пользователь хочет анврапнуть
    struct TokenInfo {
        string originalChain; // оригинальный блокчейн
        string originalTokenAddress; // адрес токена из оригинального блокчейна
        address wrappedTokenAddress; // враппед адрес на данном блокчейне
    }

    TokenInfo[] public tokenInfos;

    modifier onlyMessengerBot {
        require(hasRole(BOT_MESSENGER_ROLE, _msgSender()), "onlyMessengerBot");
        _;
    }

    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "onlyAdmin");
        _;
    }

    modifier addressIsNull(address _address) {
        require(_address != address(0), "The address is null");
        _;
    }

    modifier tokenIsAllowed(address _token) {
        require(allowedTokens[_token] != 0, "invalidToken");
        _;
    }

    modifier isSupportedChain(string memory _chain) {
        require(supportedChains[_chain], "Not supported");
        _;
    }

    constructor(
        address _bridgeStandardERC20,
        address _botMessenger,
        uint _feeRate
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(BOT_MESSENGER_ROLE, _botMessenger);
        botMessenger = _botMessenger;

        feeRate = _feeRate;

        if (_bridgeStandardERC20 != address(0)) {
            bridgeStandardERC20 = IBridgeTokenStandardERC20(_bridgeStandardERC20);
        }

    }
    // передается адрес токен, с которым должно быть взаимодействие
    function burn(
        address _token,
        string memory _to,
        uint256 _amount,
        string memory _direction
    )
    external
    override
    addressIsNull(_token)
    tokenIsAllowed(_token)
    isSupportedChain(_direction)
    returns(bool)
    {
        address sender = _msgSender();
        uint feeAmount = _calcFee(_amount);
        feeTokenAndAmount[_token] += feeAmount;

        IBridgeTokenStandardERC20(_token).safeTransferFrom(sender, address(this), _amount);
        IBridgeTokenStandardERC20(_token).burn(address(this), _amount - feeAmount);

        emit Burn(_token, sender, _to, _amount - feeAmount, _direction);

        return true;
    }

    function lock(
        address _token,
        string memory _to,
        uint256 _amount,
        string memory _direction
    )
    external
    payable
    override
    tokenIsAllowed(_token)
    isSupportedChain(_direction)
    returns(bool)
    {
        address sender = _msgSender();

        if (_token != address(0)){
            uint feeAmount = _calcFee(_amount);
            feeTokenAndAmount[_token] += feeAmount;

            IERC20(_token).safeTransferFrom(sender, address(this), _amount);

            emit Lock(_token, sender, _to, _amount - feeAmount, _direction);

            return true;
        } else {
            require(msg.value != 0, "Invalid value");

            uint feeAmount = _calcFee(msg.value);
            feeTokenAndAmount[_token] += feeAmount;

            emit Lock(_token, sender, _to, msg.value - feeAmount, _direction);

            return true;
        }
    }

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
    addressIsNull(_token)
    tokenIsAllowed(_token)
    returns(bool)
    {
        address sender = _msgSender();
        bytes32 domainSeparator = allowedTokens[_token];

        signatureVerification(_nonce, _amount, v, r, s, domainSeparator, sender);
        IBridgeTokenStandardERC20(_token).mint(sender, _amount);

        emit MintWithPermit(_token, sender, _amount);

        return true;
    }

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

            bytes32 domainSeparator = allowedTokens[_token];
            signatureVerification(_nonce, _amount, v, r, s, domainSeparator, sender);

            require(
                IERC20(_token).balanceOf(address(this)) >= feeTokenAndAmount[_token] + _amount,
                "Incorrect amount"
            );

            IERC20(_token).safeTransfer(sender, _amount);

            emit UnlockWithPermit(_token, sender, _amount);

            return true;
        } else {
            bytes32 domainSeparator = allowedTokens[_token];
            signatureVerification(_nonce, _amount, v, r, s, domainSeparator, sender);

            require(
                address(this).balance >= feeTokenAndAmount[_token] + _amount,
                "Incorrect amount"
            );

            (bool success, ) = sender.call{ value: _amount }("");

            emit UnlockWithPermit(_token, sender, _amount);

            return true;
        }
    }

    function setBridgedStandardERC20(
        address _bridgeStandardERC20
    )
    external
    onlyAdmin
    addressIsNull(_bridgeStandardERC20)
    {
        bridgeStandardERC20 = IBridgeTokenStandardERC20(_bridgeStandardERC20);
    }

    function setAdmin(address _newAdmin) external onlyAdmin {
        grantRole(DEFAULT_ADMIN_ROLE, _newAdmin);
    }

    function setAllowedToken(
        address _token,
        string memory _name
    )
    external
    onlyAdmin
    {
        bytes32 domainSeparator;
        if (_token != address(0)) {
            ERC20 token = ERC20(_token);
            domainSeparator = keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    keccak256(bytes(token.name())),
                    keccak256(bytes("1")),
                    block.chainid,
                    address(this)
                )
            );
        } else {
            // для нативной валюты
            require(bytes(_name).length != 0, "Name is empty");
            domainSeparator = keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    keccak256(bytes(_name)),
                    keccak256(bytes("1")),
                    block.chainid,
                    address(this)
                )
            );
        }
        allowedTokens[_token] = domainSeparator;
    }

    function removeAllowedToken(address _token) external onlyAdmin {
        allowedTokens[_token] = 0;
    }

    function setFeeRate(uint _feeRate) external onlyAdmin {
        require(_feeRate > 0 && _feeRate <= MAX_BP, "Out of range");
        feeRate = _feeRate;
    }

    function _calcFee(uint _amount) private view returns(uint) {
        return _amount * feeRate / MAX_BP;
    }

    function withdraw(address _token, uint _amount) external onlyAdmin {
        require(feeTokenAndAmount[_token] != 0, "Invalid token");
        require(feeTokenAndAmount[_token] >= _amount, "Incorrect amount");
        if (_token != address(0)) {
            IERC20(_token).safeTransfer(_msgSender(), _amount);
        } else {
            (bool success, ) = _msgSender().call{ value: _amount }("");
        }
        feeTokenAndAmount[_token] -= _amount;
    }

    function setSupportedChain(string memory _chain) external onlyAdmin {
        supportedChains[_chain] = true;
    }

    function removeSupportedChain(string memory _chain) external onlyAdmin {
        supportedChains[_chain] = false;
    }

    function signatureVerification(
        uint256 _nonce,
        uint256 _amount,
        uint8 v,
        bytes32 r,
        bytes32 s,
        bytes32 _domainSeparator,
        address _msgSender
    ) internal {
            require(!nonces[_nonce], "Request already processed");

            bytes32 permitDigest = getPermitDigest(
                _domainSeparator,
                _msgSender,
                _amount,
                _nonce
            );

            address signer = ecrecover(permitDigest, v, r, s);
            require(signer == botMessenger, "Invalid signature");

            nonces[_nonce] = true;
    }

    function getPermitDigest(
        bytes32 _domainSeparator,
        address _to,
        uint256 _amount,
        uint256 _nonce
    ) internal pure returns (bytes32) {
        return
        keccak256(
            abi.encodePacked(
                uint16(0x1901),
                _domainSeparator,
                keccak256(
                    abi.encode(
                        keccak256(
                            "Permit(address spender,uint256 value,uint256 nonce)"
                        ),
                        _to,
                        _amount,
                        _nonce
                    )
                )
            )
        );
    }

}
