pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract TokenMock is ERC20{

    constructor(string memory name, string memory symbol, uint256 amount, address to) ERC20(name, symbol) {
        _mint(to, amount);
    }
}
