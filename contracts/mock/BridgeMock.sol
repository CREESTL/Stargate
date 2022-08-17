// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IWrappedERC20Template.sol";

contract BridgeMock {

    IWrappedERC20Template public bridgeTokenStandard;

    constructor() {

    }

    function mint(address _client, uint amount, address _addressToken) public {
        IWrappedERC20Template(_addressToken).mint(_client, amount);
    }

    function burn(address _client, uint amount, address _addressToken) public {
        IWrappedERC20Template(_addressToken).burn(_client, amount);
    }
}
