pragma solidity ^0.8.0;

import "../interfaces/IBridgeTokenStandardERC20.sol";

contract BridgeMock {

    IBridgeTokenStandardERC20 public bridgeTokenStandard;

    constructor() {

    }

    function mint(address _client, uint amount, address _addressToken) public {
        IBridgeTokenStandardERC20(_addressToken).mint(_client, amount);
    }
}
