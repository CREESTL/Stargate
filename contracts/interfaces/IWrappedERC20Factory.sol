// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;


/// @title An inteerface of a factory of custom ERC20 tokens used in the bridge
interface IWrappedERC20Factory {

    /// @notice Creates a new token to be used in the bridge
    /// @param name The name of the new token
    /// @param symbol The symbol of the new token
    /// @param decimals The number of decimals of the new token
    /// @return The address of a new token
    function createNewToken(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) external virtual returns(address);

    /// @notiсe Checks if token is allowed to be used in the bridge
    /// @param token The address of the token to check
    /// @return True if token is allowed, false - if not
    function getAllowedToken(address) external view returns (bool);
    
    /// @notice Sets the address of the bridge of the tokens
    /// @param newBridge The address of the bridge
    function setBridge(address newBridge) external;

    /// @dev Event gets emmited each time a new token is created
    event CreateNewToken(address indexed token);
}
