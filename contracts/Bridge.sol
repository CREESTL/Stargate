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

    function requestBridgingWrappedToken(
        address _token,
        string memory _to,
        uint256 _amount,
        string memory direction
    )
    external
    override
    wrappedTokenIsAllowed(_token)
    addressIsNull(_token)
    returns(bool)
    {
        address sender = _msgSender();
        uint amountWithoutFee = _calcFee(_amount);
        IBridgeTokenStandardERC20(_token).transferFrom(sender, address(this), _amount);
        IBridgeTokenStandardERC20(_token).burn(address(this), amountWithoutFee);
        IBridgeTokenStandardERC20(_token).transfer(feeWallet, _amount - amountWithoutFee);
        emit RequestBridgingWrappedToken(_token, sender, _to, amountWithoutFee, direction);
        return true;
    }

    function requestBridgingToken(
        address _token,
        string memory _to,
        uint256 _amount,
        string memory direction
    )
    external
    override
    tokenIsAllowed(_token)
    addressIsNull(_token)
    returns(bool)
    {
        address sender = _msgSender();
        uint amountWithoutFee = _calcFee(_amount);
        IERC20(_token).safeTransferFrom(sender, address(this), _amount);
        IERC20(_token).safeTransfer(feeWallet, _amount - amountWithoutFee);
        emit RequestBridgingToken(_token, sender, _to, amountWithoutFee, direction);
        return true;
    }

    function performBridgingWrappedToken(
        address _token,
        address _to,
        uint256 _amount
    )
    external
    override
    onlyMessengerBot
    wrappedTokenIsAllowed(_token)
    addressIsNull(_token)
    returns(bool)
    {
        IBridgeTokenStandardERC20(_token).mint(_to, _amount);
        emit BridgingWrappedTokenPerformed(_token, _to, _amount);
        return true;
    }

    function performBridgingToken(
        address _token,
        address _to,
        uint256 _amount
    )
    external
    override
    onlyMessengerBot
    tokenIsAllowed(_token)
    addressIsNull(_token)
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
    addressIsNull(_token)
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
}
