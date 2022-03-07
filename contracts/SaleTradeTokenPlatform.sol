//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./ZepToken.sol";

contract ACDMPlatform is AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;
    Counters.Counter private orderIndex;
    Counters.Counter private roundIndex;

    ZepToken private token;
    address public tokenAddress;
    uint256 private decimalsMultiplier;
    uint256 public roundTimestamp = 259200; // 3 days in POSIX
    mapping(uint256 => uint256) public soldToTraded;
    mapping(address => address) public referals;
    mapping(address => bool) public registered;
    mapping(address => uint256) public etherBalances;
    mapping(address => uint256) public tokenBalances;
    mapping(uint256 => Round) private rounds;
    struct Round {
        uint256 startedAt;
        State state;
        uint256 etherVolume;
        uint256 tokenVolume;
        uint256 priceOrOrderCount;
    }
    enum State {
        Sale,
        Trade
    }
    mapping(uint256 => Order) private orders;
    struct Order {
        address seller;
        uint256 initialAmount;
        uint256 soldAmount;
        uint256 pricePerToken;
        bool isOpen;
    }

    
    event StageStarted(uint256 indexed _when, string indexed _which);
    event TokensSoldAtContract(
        address _buyer,
        uint256 indexed _price,
        uint256 indexed _amount
    );
    event TokensSoldAtOrder(
        uint256 indexed _orderId,
        address _buyer,
        uint256 indexed _price,
        uint256 indexed _amount
    );
    event OrderCreated(
        uint256 indexed _orderId,
        uint256 indexed _amount,
        uint256 indexed _pricePerToken,
        address _seller
    );
    event OrderClosedByBuyer(uint256 indexed _orderId);
    event OrderClosedBySeller(uint256 indexed _orderId);
    event OrderClosedByContract(uint256 indexed _orderId);
    event NewRegisteredUser(address indexed _user);

    constructor() {
        token = new ZepToken(msg.sender);
        tokenAddress = address(token);
        orderIndex.increment();
        roundIndex.increment();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        decimalsMultiplier = 10**token.decimals();
        rounds[roundIndex.current()] = Round(
            block.timestamp,
            State.Sale,
            0,
            100000 * decimalsMultiplier,
            10000 * 1 gwei
        );
        token.mint(address(this), rounds[roundIndex.current()].tokenVolume);
        registered[address(0)] = true;
        emit StageStarted(block.timestamp, "Sale");
    }

    function viewCurrentPlatformState()
        public
        view
        returns (string memory state)
    {
        if (rounds[roundIndex.current()].state == State.Sale) {
            state = "Sale";
        } else {
            state = "Trade";
        }
    }

    function getLeftTimestampOfStage() public view returns (uint256) {
        return (
            roundTimestamp -
            // timestamp - (how long it is)
            (block.timestamp - rounds[roundIndex.current()].startedAt));
    }

    function register(address refFather) public {
        // register is mandatory
        require(registered[msg.sender] == false, "You are already registered");
        require(registered[refFather], "Promoter is not registered yet");
        registered[msg.sender] = true;
        referals[msg.sender] = refFather;
        emit NewRegisteredUser(msg.sender);
    }

    function getAvailableTokenAmount() public view returns (uint256) {
        require(
            rounds[roundIndex.current()].state == State.Sale,
            "Please, wait for next sale round"
        );
        return(rounds[roundIndex.current()].tokenVolume);
    }

    function getCurrentTokenPrice() public view returns (uint256) {
        require(
            rounds[roundIndex.current()].state == State.Sale,
            "Please, wait for next sale round"
        );
        return (rounds[roundIndex.current()].priceOrOrderCount);
    }

    function howManyEtherToTokenAmount(uint256 amountToBuy)
        public
        view
        returns (uint256)
    {
        require(
            rounds[roundIndex.current()].state == State.Sale,
            "Please wait for sale state"
        );
        return( rounds[roundIndex.current()].priceOrOrderCount * amountToBuy);
    }

    function howManyTokensCanIBuyForEther(uint256 _ether)
        public
        view
        returns (uint256)
    {
        require(
            rounds[roundIndex.current()].state == State.Sale,
            "Please wait for sale state"
        );
        return(
            (_ether / rounds[roundIndex.current()].priceOrOrderCount) *
            decimalsMultiplier);
    }

    function getLastRoundId() public view returns (uint256) {
        return( roundIndex.current());
    }

    function getLastOrderId() public view returns (uint256) {
        return (orderIndex.current());
    }

    function buyAtContract() public payable stage(State.Sale) {
        require(msg.value > 0, "Please increase ether");
        uint256 amountToBuy = howManyTokensCanIBuyForEther(msg.value);
        console.log("Amount ot buy is ", amountToBuy);
        require(
            amountToBuy <= rounds[roundIndex.current()].tokenVolume,
            "Please check available balance"
        );
        rounds[roundIndex.current()].etherVolume += msg.value;
        rounds[roundIndex.current()].tokenVolume -= amountToBuy;
        if (rounds[roundIndex.current()].tokenVolume == 0) {
            changeStage();
        }
        console.log("Available is ", rounds[roundIndex.current()].tokenVolume);
        referalsBuyReward(msg.sender, msg.value);
        token.transfer(msg.sender, amountToBuy);
        emit TokensSoldAtContract(
            msg.sender,
            rounds[roundIndex.current()].priceOrOrderCount,
            amountToBuy
        );
    }

    function createOrder(uint256 _amount, uint256 _pricePerToken)
        public
        stage(State.Trade)
    {
        orders[orderIndex.current()] = Order(
            msg.sender,
            _amount,
            0,
            _pricePerToken,
            true
        );
        rounds[roundIndex.current()].priceOrOrderCount++;
        emit OrderCreated(
            orderIndex.current(),
            _amount,
            _pricePerToken,
            msg.sender
        );
        orderIndex.increment();
        token.transferFrom(msg.sender, address(this), _amount);
    }

    function buyAtOrder(uint256 _orderId)
        public
        payable
        stage(State.Trade)
        nonReentrant
    {
        require(orders[_orderId].isOpen, "Order closed");
        uint256 tokenAmount = tokenAmountByEtherAtOrder(_orderId, msg.value);
        orders[_orderId].soldAmount += tokenAmount;
        require(
            orders[_orderId].soldAmount <= orders[_orderId].initialAmount,
            "Value is too big"
        );
        referalsSellReward(orders[_orderId].seller, msg.value);
        if (orders[_orderId].soldAmount == orders[_orderId].initialAmount) {
            orders[_orderId].isOpen = false;
        }
        rounds[roundIndex.current()].etherVolume += msg.value;
        rounds[roundIndex.current()].tokenVolume += tokenAmount;
        token.transfer(msg.sender, tokenAmount);
        emit TokensSoldAtOrder(
            _orderId,
            msg.sender,
            orders[_orderId].pricePerToken,
            tokenAmount
        );
    }

    function closeOrder(uint256 _orderId) public nonReentrant {
        require(
            orders[_orderId].seller == msg.sender,
            "Only seller can close it"
        );
        require(orders[_orderId].isOpen == true, "It's already closed");
        orders[_orderId].isOpen = false;
        token.transfer(
            msg.sender,
            (orders[_orderId].initialAmount - orders[_orderId].soldAmount)
        );
        emit OrderClosedBySeller(_orderId);
    }

    function tokenAmountByEtherAtOrder(uint256 _orderId, uint256 _etherAmount)
        public
        view
        returns (uint256 _tokenAmount)
    {
        _tokenAmount =
            (_etherAmount / orders[_orderId].pricePerToken) *
            decimalsMultiplier;
    }

    function getFullPriceOfOrder(uint256 _orderId)
        public
        view
        returns (uint256 etherValue)
    {
        etherValue =
            ((orders[_orderId].initialAmount - orders[_orderId].soldAmount) *
                orders[_orderId].pricePerToken) /
            decimalsMultiplier;
    }

    function getOrderInfo(uint256 _id)
        public
        view
        returns (
            uint256,
            uint256,
            uint256,
            bool
        )
    {
        return( orders[_id].initialAmount,
         orders[_id].soldAmount,
         orders[_id].pricePerToken,
         orders[_id].isOpen);
    }

    function changeStage() private {
        console.log("State changing");
        if (rounds[roundIndex.current()].state == State.Sale) {
            if (rounds[roundIndex.current()].tokenVolume > 0) {
                token.burn(
                    address(this),
                    rounds[roundIndex.current()].tokenVolume
                );
            }
            roundIndex.increment();
            rounds[roundIndex.current()] = Round(
                block.timestamp,
                State.Trade,
                // false,
                0,
                0,
                0
            );
            emit StageStarted(block.timestamp, "Trade");
        } else {
            // setup tokenPrice
            uint256 newTokenPrice = (rounds[roundIndex.current() - 2]
                .priceOrOrderCount / 100) *
                103 +
                4000 *
                1 gwei;
            console.log("!new token price is ", newTokenPrice);
            // calculate tokens for new round
            uint256 tokensToMint = (rounds[roundIndex.current()].etherVolume *
                decimalsMultiplier) / newTokenPrice;
            token.mint(address(this), tokensToMint);
            console.log(tokensToMint, " tokens has been minted");
            for (
                uint256 i = orderIndex.current() -
                    rounds[roundIndex.current()].priceOrOrderCount;
                i <= rounds[roundIndex.current()].priceOrOrderCount;
                i++
            ) {
                console.log("!checking ", i, "order");
                if (orders[i].isOpen) {
                    console.log("!closing ", i, "order");
                    emit OrderClosedByContract(i);
                    orders[i].isOpen = false;
                    tokenBalances[orders[i].seller] +=
                        orders[i].initialAmount -
                        orders[i].soldAmount;
                }
            }
            // change round back to sale
            roundIndex.increment();
            rounds[roundIndex.current()] = Round(
                block.timestamp,
                State.Sale,
                0,
                tokensToMint,
                newTokenPrice
            );
            emit StageStarted(block.timestamp, "Sale");
        }
    }

    function changeStageRequest() public nonReentrant {
        require(
            block.timestamp >=
                rounds[roundIndex.current()].startedAt + roundTimestamp,
            "Stage can't be ended now"
        );
        changeStage();
    }

    function viewMyEthBalance() public view returns (uint256) {
        return ( etherBalances[msg.sender]);
    }

    function viewMyTokenBalance() public view returns (uint256) {
        return( tokenBalances[msg.sender]);
    }

    function fetchEther() public nonReentrant {
        payable(msg.sender).transfer(etherBalances[msg.sender]);
    }

    function fetchTokens() public nonReentrant {
        token.transferFrom(
            address(this),
            msg.sender,
            tokenBalances[msg.sender]
        );
    }

    function referalsBuyReward(address _buyer, uint256 _etherValue) internal {
        if (referals[_buyer] != address(0)) {
            etherBalances[referals[_buyer]] += _etherValue / 20;
            if (referals[referals[_buyer]] != address(0)) {
                etherBalances[referals[referals[_buyer]]] +=
                    (_etherValue / 100) *
                    3;
            }
        }
    }

    function referalsSellReward(address _seller, uint256 _etherValue) internal {
        etherBalances[_seller] += _etherValue;
        if (referals[_seller] != address(0)) {
            uint256 reward = _etherValue / 40;
            etherBalances[referals[_seller]] += reward;
            etherBalances[_seller] -= reward;
            if (referals[referals[_seller]] != address(0)) {
                etherBalances[referals[referals[_seller]]] += reward;
                etherBalances[_seller] -= reward;
            }
        }
    }

    modifier stage(State _state) {
        if (
            block.timestamp >=
            rounds[roundIndex.current()].startedAt + roundTimestamp
        ) {
            changeStage();
        }
        require(registered[msg.sender], "You are not registered yet");
        require(
            _state == rounds[roundIndex.current()].state,
            "Can't be execute at this time, please check state of platform"
        );
        _;
    }
}
