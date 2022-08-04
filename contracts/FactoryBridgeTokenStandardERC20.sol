pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "./interfaces/IFactoryBridgeTokenStandardERC20.sol";
import "./interfaces/IBridgeTokenStandardERC20.sol";

contract FactoryBridgeTokenStandardERC20 is IFactoryBridgeTokenStandardERC20, AccessControl {

    using Clones for address;

    address public bridge;

//    mapping(address => bool) private allowedTokens;
    address[] private allowedTokens;

    IBridgeTokenStandardERC20 public bridgeTokenStandard;

    bytes32 public constant BOT_MESSANGER_ROLE = keccak256("BOT_MESSANGER_ROLE");

    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "onlyAdmin");
        _;
    }

    constructor(address _bridgeTokenStandard, address _bridge) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        if (_bridgeTokenStandard != address(0)) {
            bridgeTokenStandard = IBridgeTokenStandardERC20(_bridgeTokenStandard);
        }
        if (_bridge != address(0)) {
            bridge = _bridge;
        }
    }

    //TODO: подумать над методом защиты от повторного развертывания токена
    function createNewToken(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) external onlyAdmin returns (address) {
        require(address(bridgeTokenStandard) != address(0), "Token template is not install");
        require(bridge != address(0), "Token template is not install");
        address token = address(bridgeTokenStandard).clone();
        IBridgeTokenStandardERC20(token).configure(
            bridge,
            _name,
            _symbol,
            _decimals
        );
//        allowedTokens[token] = true;
//        emit CreateNewToken(token);
        allowedTokens.push(token);
        return token;
    }

    function setBridge(address _bridge) external onlyAdmin {
        require(_bridge != address(0), "Address is null");
        bridge = _bridge;
    }

    function getAllowedToken(address _token) public view returns(bool) {
//        return allowedTokens[_token];
        for (uint i = 0; i < allowedTokens.length; i++){
            if (allowedTokens[i] == _token) {
                return true;
            }
        }
        return false;
    }

    function removeFromAllowedToken(address _token) public onlyAdmin {
//        require(allowedTokens[_token], "Token is not allowed");
//        allowedTokens[_token] = false;
        for (uint i = 0; i < allowedTokens.length; i++){
            if (allowedTokens[i] == _token) {
                allowedTokens[i] = allowedTokens[allowedTokens.length - 1];
                allowedTokens.pop();
                break;
            }
        }

    }

    function setBridgeTokenStandardERC20(address _bridgeTokenStandardERC20) public onlyAdmin {
        require(_bridgeTokenStandardERC20 != address(0), "Address is null");
        bridgeTokenStandard = IBridgeTokenStandardERC20(_bridgeTokenStandardERC20);
    }

    function getAllowedTokens() public view returns (address[] memory) {
        return allowedTokens;
    }
}
