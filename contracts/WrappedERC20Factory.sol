// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "./interfaces/IWrappedERC20Factory.sol";
import "./interfaces/IWrappedERC20.sol";
import "./WrappedERC20.sol";


/// @title A factory of custom ERC20 tokens used in the bridge
contract WrappedERC20Factory is IWrappedERC20Factory, AccessControl {


    /// @dev Map of addresses of tokens in the original and target chains
    mapping(address => address) internal originalToWrappedTokens;

    /// @dev Struct holds the name of the original chain and the address of the original token
    /// @dev Used to see what was the original chain of the wrapped token
    struct TokenInfo {
        string originalChain;
        address originalAddress;
    }

    /// @dev Map of addresses of wrapped tokens and addresses of original tokens and original chains
    mapping(address => TokenInfo) internal wrappedToOriginalTokens;

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
    /// @return True if a wrapped token exists for a given original token
    function checkTargetToken(address originalToken) public view returns (bool) {
        require(originalToken != address(0), "Factory: original token can not have a zero address!");
        // If there is no value for `originalToken` key then address(0) will be returned from the map
        if (originalToWrappedTokens[originalToken] != address(0)) {
            return true;
        }
        return false;
    }

    /// @notice Returns the name of the original token and the original chain for a wrapped token
    /// @param wrappedToken The address of the wrapped token
    /// @return The name of the original chain and the address of the original token
    function checkOriginalToken(address wrappedToken) public view returns (TokenInfo memory) {
        require(wrappedToken != address(0), "Factory: wrapped token can not have a zero address!");
        require(
            bytes(wrappedToOriginalTokens[wrappedToken].originalChain).length > 0,
            "Factory: no original token found for a wrapped token!"
        );
        return wrappedToOriginalTokens[wrappedToken];

    }

    /// @notice Creates a new wrapped token on the target chain
    /// @dev Should be deployed on the target chain
    /// @param originalChain The name of the original chain
    /// @param originalToken The address of the original token
    /// @param name The name of the new token
    /// @param symbol The symbol of the new token
    /// @param decimals The number of decimals of the new token
    /// @param bridge The address of the bridge of tokens
    /// @return The address of a new token
    function createNewToken(
        string memory originalChain,
        address originalToken,
        string memory name,
        string memory symbol,
        uint8 decimals,
        address bridge
    ) external returns (address) {

        require(bytes(originalChain).length > 0, "Factory: chain name is too short!");
        require(bytes(name).length > 0, "Factory: new token name is too short!");
        require(bytes(symbol).length > 0, "Factory: new token symbol is too short!");
        require(decimals > 0, "Factory: invalid decimals!");
        require(bridge != address(0), "Factory: bridge can not have a zero address!");

        // This will create a new token on the same chain the factory is deployed on (target chain)
        WrappedERC20 wrappedToken = new WrappedERC20(name, symbol, decimals, bridge);
        // Map the original token to the wrapped token 
        originalToWrappedTokens[originalToken] = address(wrappedToken);

        // And do the same backwards: map the wrapped token to the original token and original chain
        TokenInfo memory wrappedTokenInfo = TokenInfo(originalChain, originalToken);
        wrappedToOriginalTokens[address(wrappedToken)] = wrappedTokenInfo;

        emit CreateNewToken(originalChain, originalToken, wrappedToken.name(), address(wrappedToken));
        
        return address(wrappedToken);
    }
}
