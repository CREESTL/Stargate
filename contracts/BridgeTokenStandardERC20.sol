// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import "./interfaces/IBridgeTokenStandardERC20.sol";

contract BridgeTokenStandardERC20 is IBridgeTokenStandardERC20, ERC20, Initializable {

    string internal __name;
    string internal __symbol;
    uint8 internal __decimals;

    address public bridge;

    constructor() ERC20("", "") {}

    modifier onlyBridge {
        require(_msgSender() == bridge, "onlyBridge");
        _;
    }

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

    function name() public view override(ERC20, IBridgeTokenStandardERC20) returns(string memory) {
        return __name;
    }

    function symbol() public view override(ERC20, IBridgeTokenStandardERC20) returns(string memory) {
        return __symbol;
    }

    function decimals() public view override(ERC20, IBridgeTokenStandardERC20) returns(uint8) {
        return __decimals;
    }

    function mint(address _to, uint256 _amount) public virtual override onlyBridge {
        _mint(_to, _amount);
        emit Mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount) public virtual override onlyBridge {
        _burn(_from, _amount);
        emit Burn(_from, _amount);
    }
}
