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
        uint256 _amount,
        uint256 _nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns(bool);

    function unlockWithPermit(
        address _token,
        uint256 _amount,
        uint256 _nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns(bool);

    event Lock(
        address indexed _token,
        address indexed _sender,
        string _to,
        uint _amount,
        string _direction
    );

    event Burn(
        address indexed _token,
        address indexed _sender,
        string _to,
        uint _amount,
        string _direction
    );

    event MintWithPermit(
        address indexed _token,
        address indexed _to,
        uint _amount
    );

    event UnlockWithPermit(
        address indexed _token,
        address indexed _to,
        uint _amount
    );

}
