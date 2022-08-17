// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "./interfaces/IWrappedERC20Factory.sol";
import "./interfaces/IWrappedERC20.sol";
import "./WrappedERC20.sol";


/// @title A factory of custom ERC20 tokens used in the bridge
contract WrappedERC20Factory is IWrappedERC20Factory, AccessControl {

    /// @dev The address of the bridge contract
    address public bridge;

    /// @dev Map of addresses of tokens in the original and target chains
    mapping(address => address) internal originalTargetTokens;

    /// @dev Role required to call functions of the factory
    bytes32 public constant BOT_MESSANGER_ROLE = keccak256("BOT_MESSANGER_ROLE");

    /// @dev Checks if a caller has admin rights
    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Factory: caller is not an admin!");
        _;
    }

    /// @notice Sets the default bridge of the tokens
    /// @param _bridge Address of the briage of the tokens
    constructor(address _bridge) {
        // Caller gets admin rights
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        require(_bridge != address(0), "Factory: bridge can not have a zero address!");
        bridge = _bridge;
    }

    /// @notice Checks if there is a wrapped token in the target chain for the original token 
    /// @param originalToken The address of the original token to check
    function checkTargetToken(address originalToken) public view returns (bool) {
        require (originalToken != address(0), "Factory: original token can not have a zero address!");
        // If there is no value for `originalToken` key then address(0) will be returned from the map
        if (originalTargetTokens[originalToken] != address(0)) {
            return true;
        }
        return false;
    }

    /// @notice Creates a new wrapped token on the target chain
    /// @dev Should be deployed on the target chain
    /// @param originalToken The address of the original token
    /// @param name The name of the new token
    /// @param symbol The symbol of the new token
    /// @param decimals The number of decimals of the new token
    /// @return The address of a new token
    function createNewToken(
        address originalToken,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) external onlyAdmin returns (address) {
        // This will create a new token on the same bridge the factory is deployed on (target chain)
        WrappedERC20 wrappedToken = new WrappedERC20(name, symbol, decimals);
        originalTargetTokens[originalToken] = address(wrappedToken);

        emit CreateNewToken(address(wrappedToken));
        
        return address(wrappedToken);
    }
    
    /// @notice Sets the address of the bridge of the tokens
    /// @param newBridge The address of the bridge
    function setBridge(address newBridge) external onlyAdmin {
        require(newBridge != address(0), "Factory: bridge can not have a zero address!");
        bridge = newBridge;
    }
}
