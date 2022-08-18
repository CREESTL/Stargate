// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;


/// @title An inteerface of a factory of custom ERC20 tokens used in the bridge
interface IWrappedERC20Factory {

    /// @notice Creates a new token to be used in the bridge
    /// @param originalChain The name of the original chain
    /// @param originalToken The address of the original token on the original chain
    /// @param name The name of the new token
    /// @param symbol The symbol of the new token
    /// @param decimals The number of decimals of the new token
    /// @return The address of a new token
    function createNewToken(
        string memory originalChain,
        address originalToken,
        string memory name,
        string memory symbol,
        uint8 decimals,
        address bridge
    ) external returns(address);

    /// @dev Event gets emmited each time a new token is created
    event CreateNewToken(
        string indexed originalChain,
        address originalToken,
        string  name, 
        address indexed token
    );
}
