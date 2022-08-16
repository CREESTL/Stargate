// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "./interfaces/IFactoryBridgeTokenStandardERC20.sol";
import "./interfaces/IBridgeTokenStandardERC20.sol";


/// @title A factory of custom ERC20 tokens used in the bridge
contract FactoryBridgeTokenStandardERC20 is IFactoryBridgeTokenStandardERC20, AccessControl {

    /// @dev Allows to call `clone()` method on address
    using Clones for address;

    /// @dev The address of the bridge contract
    address public bridge;

    /// @dev A map of tokens that can be used in the bridge (for checking)
    mapping(address => bool) private allowedMap;
    /// @dev A list of tokens that can be used in the bridge (for storing and using on frontend)
    address[] private allowedList;

    /// @dev A custom ERC20 token
    IBridgeTokenStandardERC20 public bridgeTokenStandard;

    bytes32 public constant BOT_MESSANGER_ROLE = keccak256("BOT_MESSANGER_ROLE");

    /// @dev Checks if a caller has admin rights
    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Factory: caller is not an admin!");
        _;
    }

    /// @notice Sets the default token as well as the bridge of the tokens
    /// @param _bridgeTokenStandard Address of the custom ERC20 token to be used in the bridge
    /// @param _bridge Address of the briage of the tokens
    constructor(address _bridgeTokenStandard, address _bridge) {
        // Caller gets admin rights
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        // Initialise the prototype of the token
        if (_bridgeTokenStandard != address(0)) {
            bridgeTokenStandard = IBridgeTokenStandardERC20(_bridgeTokenStandard);
        }
        // Initialize the bridge 
        if (_bridge != address(0)) {
            bridge = _bridge;
        }
    }

    //TODO: prevent repeated token creation!
    /// @notice Creates a new token to be used in the bridge
    /// @param _name The name of the new token
    /// @param _symbol The symbol of the new token
    /// @param _decimals The number of decimals of the new token
    /// @return The address of a new token
    function createNewToken(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) external onlyAdmin returns (address) {
        // Token can not have a zero address
        require(address(bridgeTokenStandard) != address(0), "Factory: token can not have a zero address!");
        // Bridge can not have a zero address
        require(bridge != address(0), "Factory: bridge can not have a zero address!");
        // Get the address of the token prototype
        address tokenAddress = address(bridgeTokenStandard).clone();
        // Connect the interface to this address and configure the prototype this way
        IBridgeTokenStandardERC20(tokenAddress).configure(
            bridge,
            _name,
            _symbol,
            _decimals
        );
        // Add the address of a fresh token to the list of tokens that can be used in the bridge
        allowedMap[tokenAddress] = true;
        allowedList.push(tokenAddress);

        emit CreateNewToken(tokenAddress);
        
        return tokenAddress;
    }


    /// @notiсe Checks if token is allowed to be used in the bridge
    /// @param _token The address of the token to check
    /// @return True if token is allowed, false - if not
    function getAllowedToken(address _token) public view returns(bool) {
        return allowedMap[_token];
    }


    /// @notice Forbids the token to be used in the bridge
    /// @param _token The address of the token to forbid
    function removeFromAllowedToken(address _token) public onlyAdmin {
        allowedMap[_token] = false;
        uint length = allowedList.length;
        // Full iteration is the only way. Costly operation.
        for (uint i = 0; i < length; i++) {
            if (allowedList[i] == _token) {
                delete allowedList[i];
            }
        }
    }
    
    /// @notice Sets the address of the bridge of the tokens
    /// @param _bridge The address of the bridge
    function setBridge(address _bridge) external onlyAdmin {
        require(_bridge != address(0), "Factory: bridge can not have a zero address!");
        bridge = _bridge;
    }

    /// @notice Sets the default bridge token
    /// @param _bridgeTokenStandardERC20 The address of the token
    function setBridgeTokenStandardERC20(address _bridgeTokenStandardERC20) public onlyAdmin {
        require(_bridgeTokenStandardERC20 != address(0), "Factory: token can not have a zero address!");
        bridgeTokenStandard = IBridgeTokenStandardERC20(_bridgeTokenStandardERC20);
    }

    /// @notice Returns the map of allowed tokens
    function getAllowedTokens() public view returns (address[] memory) {
        return allowedList;
    }
}
