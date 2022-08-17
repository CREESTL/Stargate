// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import "./interfaces/IWrappedERC20Template.sol";

/// @title A custom ERC20 contract used in the bridge
contract WrappedERC20Template is IWrappedERC20Template, ERC20, Initializable {

    string internal __name;
    string internal __symbol;
    uint8 internal __decimals;

    address public bridge;

    ///@ dev The tokens does not need a name or symbol as it is used as an equivalent of other ERC20 tokens
    constructor() ERC20("", "") {}


    /// @dev Checks if the caller is the bridge contract
    modifier onlyBridge {
        require(_msgSender() == bridge, "BridgeToken: caller is not a bridge!");
        _;
    }

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
    ) external override initializer {
        bridge = _bridge;
        __name = _name;
        __symbol = _symbol;
        __decimals = _decimals;
    }

    /// @notice Returns the name of the token
    /// @return The name of the token
    function name() public view override(ERC20, IWrappedERC20Template) returns(string memory) {
        return __name;
    }

    /// @notice Returns the symbol of the token
    /// @return The symbol of the token
    function symbol() public view override(ERC20, IWrappedERC20Template) returns(string memory) {
        return __symbol;
    }

    /// @notice Returns number of decimals of the token
    /// @return The number of decimals of the token
    function decimals() public view override(ERC20, IWrappedERC20Template) returns(uint8) {
        return __decimals;
    }

    /// @notice Creates tokens and assigns them to account, increasing the total supply.
    /// @param _to The receiver of tokens
    /// @param _amount The amount of tokens to mint
    function mint(address _to, uint256 _amount) public virtual override onlyBridge {
        _mint(_to, _amount);
        emit Mint(_to, _amount);
    }

    
    /// @notice Destroys tokens from account, reducing the total supply.
    /// @param _from The address holding the tokens
    /// @param _amount The amount of tokens to burn
    function burn(address _from, uint256 _amount) public virtual override onlyBridge {
        _burn(_from, _amount);
        emit Burn(_from, _amount);
    }
}
