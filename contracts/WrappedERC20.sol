// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./interfaces/IWrappedERC20.sol";

/// @title A custom ERC20 contract used in the bridge
contract WrappedERC20 is IWrappedERC20, ERC20 {

    address private _bridge;
    uint8 private _decimals;

    /// @dev Creates a token with an upgraded functionality of ERC20 token 
    /// @param name The name of the token
    /// @param symbol The symbol of the token
    /// @param decimals Number of decimals of the token
    /// @param bridge The address of the bridge of the tokens 
    constructor(string memory name, string memory symbol, uint8 decimals_, address bridge_) 
        ERC20(name, symbol) {
            _decimals = decimals_;
            _bridge = bridge_;
        }

    /// @dev Checks if the caller is the bridge contract
    modifier onlyBridge {
        require(msg.sender == _bridge, "BridgeToken: caller is not a bridge!");
        _;
    }

    /// @notice Returns number of decimals of the token
    /// @return The number of decimals of the token
    function decimals() public view override returns(uint8) {
        return _decimals;
    }

    /// @notice Creates tokens and assigns them to account, increasing the total supply.
    /// @param to The receiver of tokens
    /// @param amount The amount of tokens to mint
    function mint(address to, uint256 amount) public virtual onlyBridge {
        _mint(to, amount);
        emit Mint(to, amount);
    }

    /// @notice Returns the address of the bridge
    /// @return The address of the bridge
    function bridge() public view virtual returns(address) {
        return _bridge;
    }
    
    /// @notice Destroys tokens from account, reducing the total supply.
    /// @param from The address holding the tokens
    /// @param amount The amount of tokens to burn
    function burn(address from, uint256 amount) public virtual onlyBridge {
        _burn(from, amount);
        emit Burn(from, amount);
    }
}
