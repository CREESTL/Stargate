pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IBridge.sol";
import "./interfaces/IBridgeTokenStandardERC20.sol";

contract Bridge is IBridge, AccessControl {

    using SafeERC20 for IERC20;

    bytes32 public constant BOT_MESSENGER_ROLE = keccak256("BOT_MESSENGER_ROLE");

    IBridgeTokenStandardERC20 public bridgeStandardERC20;

    mapping(address => bool) public allowedTokens;
    mapping(address => bool) public allowedWrappedTokens;

    uint private constant MAX_BP = 1000;
    uint public feeRate;

    address public feeWallet;

    struct TokenInfo {
        string originalChain;
        string originalTokenAddress;
        address wrappedTokenAddress;
    }

//    struct SupportedChain {
//        string name;
//        bool isSupported;
//    }

    TokenInfo[] public tokenInfos;
//    SupportedChain[] public supportedChains;
    mapping(string => bool) public supportedChains;

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
        require(allowedTokens[_token], "invalidToken");
        _;
    }

    modifier wrappedTokenIsAllowed(address _token) {
        require(allowedWrappedTokens[_token], "invalidToken");
        _;
    }

    modifier isSupportedChain(string memory _chain) {
        require(supportedChains[_chain], "Not supported");
        _;
    }

    constructor(
        address _bridgeStandardERC20,
        address _botMessenger,
        uint _feeRate,
        address _feeWallet
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(BOT_MESSENGER_ROLE, _botMessenger);

        feeRate = _feeRate;
        feeWallet = _feeWallet;

        if (_bridgeStandardERC20 != address(0)) {
            bridgeStandardERC20 = IBridgeTokenStandardERC20(_bridgeStandardERC20);
        }
    }

    function burn(
        address _token,
        string memory _to,
        uint256 _amount,
        string memory _direction
    )
    external
    override
    addressIsNull(_token)
    wrappedTokenIsAllowed(_token)
    isSupportedChain(_direction)
    returns(bool)
    {
        address sender = _msgSender();
        uint feeAmount = _calcFee(_amount);
        IBridgeTokenStandardERC20(_token).transferFrom(sender, address(this), _amount);
        IBridgeTokenStandardERC20(_token).burn(address(this), feeAmount);
        IBridgeTokenStandardERC20(_token).transfer(feeWallet, _amount - feeAmount);
        emit RequestBridgingWrappedToken(_token, sender, _to, _amount - feeAmount, _direction);
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
            IERC20(_token).safeTransferFrom(sender, address(this), _amount);
            IERC20(_token).safeTransfer(feeWallet, _amount - feeAmount);
            emit RequestBridgingToken(_token, sender, _to, _amount - feeAmount, _direction);
            return true;
        } else {
            require(msg.value != 0, "Invalid value");
            uint feeAmount = _calcFee(msg.value);
            (bool success, bytes memory data) = feeWallet.call{ value: feeAmount }("");
            emit RequestBridgingToken(_token, sender, _to, msg.value - feeAmount, _direction);
            return true;
        }
    }

    function mintWithPermit(
        address _token,
        address _to,
        uint256 _amount
    )
    external
    override
    onlyMessengerBot
    addressIsNull(_token)
    wrappedTokenIsAllowed(_token)
    returns(bool)
    {
        IBridgeTokenStandardERC20(_token).mint(_to, _amount);
        emit BridgingWrappedTokenPerformed(_token, _to, _amount);
        return true;
    }

    function unlockWithPermit(
        address _token,
        address _to,
        uint256 _amount
    )
    external
    override
    onlyMessengerBot
    addressIsNull(_token)
    tokenIsAllowed(_token)
    returns(bool)
    {
        IERC20(_token).safeTransfer(_to, _amount);
        emit BridgingTokenPerformed(_token, _to, _amount);
        return true;
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
        bool _status
    )
    external
    onlyAdmin
//    addressIsNull(_token)
    {
        allowedTokens[_token] = _status;
    }

    function setAllowedWrappedToken(
        address _token,
        bool _status
    )
    external
    onlyAdmin
    addressIsNull(_token)
    {
        allowedWrappedTokens[_token] = _status;
    }

    function setFeeRate(uint _feeRate) external onlyAdmin {
        require(_feeRate > 0 && _feeRate <= MAX_BP, "Out of range");
        feeRate = _feeRate;
    }

    function setFeeWallet(address _feeWallet) external onlyAdmin {
        feeWallet = _feeWallet;
    }

    function _calcFee(uint _amount) private view returns(uint) {
        return _amount * feeRate / MAX_BP;
    }

    function evacuateToken(address _token, uint _amount) external onlyAdmin {
        if (_token != address(0)) {
            IERC20(_token).transfer(_msgSender(), _amount);
        } else {
            (bool success, ) = _msgSender().call{ value: _amount }("");
        }
    }

    function setSupportedChain(string memory _chain) external onlyAdmin {
//        SupportedChain memory chain = SupportedChain(_chain, true);
//        supportedChains.push(chain);
        supportedChains[_chain] = true;
    }

    function removeSupportedChain(string memory _chain) external onlyAdmin {
//        supportedChains[_index].isSupported = false;
        supportedChains[_chain] = false;
    }
}
