pragma solidity ^0.8.0;

interface IBridgeTokenStandardERC20 {
    function configure(
        address _bridge,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) external;
//    function bridgingToken() external returns (address);
    function mint(address _to, uint256 _amount) external;
    function burn(address _from, uint256 _amount) external;

    function name() external view returns(string memory);
    function symbol() external view returns(string memory);
    function decimals() external view returns(uint8);

    event Mint(address indexed _account, uint256 _amount);
    event Burn(address indexed _account, uint256 _amount);
}
