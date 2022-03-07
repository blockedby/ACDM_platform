//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
//contract and interface are fully satisfied by https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20.md
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IERC20 {
    // getters
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    // functions
    function transfer(address recipient, uint256 amount)
        external
        returns (bool);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}

contract ZepToken is IERC20, AccessControl {
    mapping(address => uint256) private balances;
    mapping(address => mapping(address => uint256)) private allowed;

    string private _name = "ACDMtoken";
    string private _symbol = "ACDM";
    uint256 private _decimals = 18;
    uint256 private _totalSupply;
    address private _owner;
    bytes32 public constant MINTER = keccak256("MINTER");
    bytes32 public constant BURNER = keccak256("BURNER");

    // cutted due to solidity-coverage error:
    // Error in plugin solidity-coverage: Error: Could not instrument: ZepToken.sol. (Please verify solc can compile this file without errors.) mismatched input '(' expecting {';', '='} (32:20)
    // error Unauthorized();

    constructor(address admin) {
        _owner = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER, msg.sender);
        _grantRole(BURNER, msg.sender);
    }
    function setupPlatform(address platformAddr) public {
        require(hasRole(DEFAULT_ADMIN_ROLE,msg.sender));
        _grantRole(MINTER, platformAddr);
        _grantRole(BURNER, platformAddr);
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function name() public view returns (string memory) {
        return _name;
    }

    function decimals() public view returns (uint256) {
        return _decimals;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function balanceOf(address person) public view override returns (uint256) {
        return balances[person];
    }

    function allowance(address person, address spender)
        public
        view
        override
        returns (uint256)
    {
        return allowed[person][spender];
    }

    function transfer(address to, uint256 value)
        public
        override
        returns (bool)
    {
        require(value <= balances[msg.sender], "Balance less then value");
        require(to != address(0), "'To' can't be zero");

        balances[msg.sender] -= value;
        balances[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value)
        public
        override
        returns (bool)
    {
        require(spender != address(0), "'Spender' can't be zero");

        allowed[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public override returns (bool) {
        require(value <= balances[from], "Balance less then value");
        require(
            value <= allowed[from][msg.sender],
            "Unauthorised, please approve"
        );
        require(to != address(0), "'To' can't be zero");

        balances[from] -= value;
        balances[to] += value;
        allowed[from][msg.sender] -= value;
        emit Transfer(from, to, value);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue)
        public
        returns (bool)
    {
        require(spender != address(0), "'Spender' can't be zero");

        allowed[msg.sender][spender] += addedValue;
        emit Approval(msg.sender, spender, allowed[msg.sender][spender]);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue)
        public
        returns (bool)
    {
        require(spender != address(0), "'Spender' can't be zero");

        allowed[msg.sender][spender] -= subtractedValue;
        emit Approval(msg.sender, spender, allowed[msg.sender][spender]);
        return true;
    }

    function mint(address account, uint256 amount) public {
        require(hasRole(MINTER, msg.sender), "You don't have minter role");
        require(account != address(0), "Account can't be zero");
        _totalSupply += amount;
        balances[account] += amount;
        emit Transfer(address(0), account, amount);
    }

    function burn(address account, uint256 amount) public {
        require(hasRole(BURNER, msg.sender), "You don't have burner role");
        require(account != address(0), "Account can't be zero");
        require(amount <= balances[account], "Account doesn't own such amount");

        _totalSupply -= amount;
        balances[account] -= amount;
        emit Transfer(account, address(0), amount);
    }
    // **deprecated 
    // modifier onlyBy(address _account) {
    //     require(msg.sender == _account, "Unauthorized");
    //     // revert Unauthorized();
    //     _;
    // }
}
