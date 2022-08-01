pragma solidity ^0.8.0;

interface IFactoryBridgeTokenStandardERC20 {
    function createNewToken(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) external virtual returns(address);

    function getAllowedToken(address) external view returns (bool);
    function setBridge(address _bridge) external;

    event CreateNewToken(address indexed _token);
}
