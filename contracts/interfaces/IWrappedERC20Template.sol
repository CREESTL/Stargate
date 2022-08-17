// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/// @title An interface for a custom ERC20 contract used in the bridge
interface IWrappedERC20Template is IERC20 {


    /// @notice Returns the address of the bridge contract
    /// @return The address of the bridge contract
    function bridge() external view returns(address);

    /// @notice Creates tokens and assigns them to account, increasing the total supply.
    /// @param _to The receiver of tokens
    /// @param _amount The amount of tokens to mint
    function mint(address _to, uint256 _amount) external;

    /// @notice Destroys tokens from account, reducing the total supply.
    /// @param _from The address holding the tokens
    /// @param _amount The amount of tokens to burn
    function burn(address _from, uint256 _amount) external;

    /// @notice Is emitted on every mint of the token
    event Mint(address indexed account, uint256 amount);
    
    /// @notice Is emitted on every burn of the token
    event Burn(address indexed account, uint256 amount);
}
