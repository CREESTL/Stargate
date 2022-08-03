pragma solidity ^0.8.0;

interface IBridge {
    function burn(
        address _token,
        string memory _to,
        uint256 _amount,
        string memory _direction
    ) external returns(bool);

    function lock(
        address _token,
        string memory _to,
        uint256 _amount,
        string memory _direction
    ) external payable returns(bool);

    function mintWithPermit(
        address _token,
        address _to,
        uint256 _amount
    ) external returns(bool);

    function unlockWithPermit(
        address _token,
        address _to,
        uint256 _amount
    ) external returns(bool);

    event RequestBridgingToken(
        address indexed _token,
        address indexed _sender,
        string _to,
        uint _amount,
        string _direction
    );

    event RequestBridgingWrappedToken(
        address indexed _token,
        address indexed _sender,
        string _to,
        uint _amount,
        string _direction
    );

    event BridgingWrappedTokenPerformed(
        address indexed _token,
        address indexed _to,
        uint _amount
    );

    event BridgingTokenPerformed(
        address indexed _token,
        address indexed _to,
        uint _amount
    );

}
