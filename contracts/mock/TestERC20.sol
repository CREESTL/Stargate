// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20{
    constructor(string memory name_, string memory symbol_)
        ERC20(name_, symbol_) {
            _mint(msg.sender, 777777777*1e18);
        }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
    function burn(address account, uint256 amount) external {
        _burn(account, amount);
    }
}
