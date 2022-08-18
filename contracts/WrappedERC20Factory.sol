// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "./interfaces/IWrappedERC20Factory.sol";
import "./interfaces/IWrappedERC20.sol";
import "./WrappedERC20.sol";


/// @title A factory of custom ERC20 tokens used in the bridge
contract WrappedERC20Factory is IWrappedERC20Factory, AccessControl {


    /// @dev Map of addresses of tokens in the original and target chains
    // TODO add original chain names here (struct)
    mapping(address => address) internal originalTargetTokens;

    /// @dev Role required to call functions of the factory
    bytes32 public constant BOT_MESSANGER_ROLE = keccak256("BOT_MESSANGER_ROLE");

    /// @dev Checks if a caller has admin rights
    modifier onlyAdmin {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Factory: caller is not an admin!");
        _;
    }

    /// @notice Gives caller admin rights
    constructor() {
        // Caller gets admin rights
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @notice Checks if there is a wrapped token in the target chain for the original token 
    /// @param originalToken The address of the original token to check
    function checkTargetToken(address originalToken) public view onlyAdmin returns (bool){
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
    /// @param bridge The address of the bridge of tokens
    /// @return The address of a new token
    function createNewToken(
        address originalToken,
        string memory name,
        string memory symbol,
        uint8 decimals,
        address bridge
    ) external returns (address) {
        // This will create a new token on the same chain the factory is deployed on (target chain)
        WrappedERC20 wrappedToken = new WrappedERC20(name, symbol, decimals, bridge);
        originalTargetTokens[originalToken] = address(wrappedToken);

        emit CreateNewToken(address(wrappedToken));
        
        return address(wrappedToken);
    }
}
