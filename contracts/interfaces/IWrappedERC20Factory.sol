// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;


/// @title An inteerface of a factory of custom ERC20 tokens used in the bridge
interface IWrappedERC20Factory {

    /// @notice Creates a new token to be used in the bridge
    /// @param _name The name of the new token
    /// @param _symbol The symbol of the new token
    /// @param _decimals The number of decimals of the new token
    /// @return The address of a new token
    function createNewToken(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) external virtual returns(address);

    /// @notiсe Checks if token is allowed to be used in the bridge
    /// @param _token The address of the token to check
    /// @return True if token is allowed, false - if not
    function getAllowedToken(address) external view returns (bool);
    
    /// @notice Sets the address of the bridge of the tokens
    /// @param _bridge The address of the bridge
    function setBridge(address _bridge) external;

    /// @dev Event gets emmited each time a new token is created
    event CreateNewToken(address indexed _token);
}
