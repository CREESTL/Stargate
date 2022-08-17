// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/// @title An interface for a custom ERC20 contract used in the bridge
interface IWrappedERC20Template is IERC20 {


    /// @notice Returns the address of the bridge contract
    /// @return The address of the bridge contract
    function bridge() external view returns(address);

    /// @notice Is emitted on every mint of the token
    event Mint(address indexed account, uint256 amount);
    
    /// @notice Is emitted on every burn of the token
    event Burn(address indexed account, uint256 amount);
}
