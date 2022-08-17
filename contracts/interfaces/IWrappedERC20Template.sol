// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/// @title An interface for a custom ERC20 contracts used in the bridge
interface IWrappedERC20Template is IERC20{
    /// @notice Configures internal variables
    /// @param _bridge The adress of the bridge for the tokens
    /// @param _name The name of the token
    /// @param _symbol The symbol of the token
    /// @param _decimals The number of decimals of the token
    function configure(
        address _bridge,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) external;
    
    /// @notice Creates tokens and assigns them to account, increasing the total supply.
    /// @param _to The receiver of tokens
    /// @param _amount The amount of tokens to mint
    function mint(address _to, uint256 _amount) external;
    
    /// @notice Destroys tokens from account, reducing the total supply.
    /// @param _from The address holding the tokens
    /// @param _amount The amount of tokens to burn
    function burn(address _from, uint256 _amount) external;

    /// @notice Returns the name of the token
    /// @return The name of the token
    function name() external view returns(string memory);

    /// @notice Returns the symbol of the token
    /// @return The symbol of the token
    function symbol() external view returns(string memory);

    /// @notice Returns number of decimals of the token
    /// @return The number of decimals of the token
    function decimals() external view returns(uint8);

    /// @notice Returns the name of the bridge
    /// @return The name of the bridge
    function bridge() external view returns(address);


    /// @notice Is emitted on every mint of the token
    event Mint(address indexed _account, uint256 _amount);
    
    /// @notice Is emitted on every burn of the token
    event Burn(address indexed _account, uint256 _amount);
}
