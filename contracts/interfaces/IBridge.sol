pragma solidity ^0.8.0;

interface IBridge {
    function requestBridgingWrappedToken(
        address _token,
        string memory _to,
        uint256 _amount,
        string memory direction
    ) external returns(bool);

    function requestBridgingToken(
        address _token,
        string memory _to,
        uint256 _amount,
        string memory direction
    ) external returns(bool);

    function performBridgingWrappedToken(
        address _token,
        address _to,
        uint256 _amount
    ) external returns(bool);

    function performBridgingToken(
        address _token,
        address _to,
        uint256 _amount
    ) external returns(bool);

    event RequestBridgingToken(
        address _token,
        address sender,
        string _to,
        uint _amount,
        string direction
    );

    event RequestBridgingWrappedToken(
        address _token,
        address sender,
        string _to,
        uint _amount,
        string direction
    );

    event BridgingWrappedTokenPerformed(
        address _token,
        address _to,
        uint _amount
    );

    event BridgingTokenPerformed(
        address _token,
        address _to,
        uint _amount
    );

}
