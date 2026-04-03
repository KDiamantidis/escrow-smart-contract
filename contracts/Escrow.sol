// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/proxy/Clones.sol";

contract Escrow {
    // Participants
    address public buyer;
    address public seller;
    address public arbiter; // Neutral third-party

    // Timing
    uint256 public deadline;
    uint256 public constant TIMEOUT = 7 days;

    // State Machine
    enum State {
        AWAITING_PAYMENT,   // 0
        AWAITING_DELIVERY,  // 1
        COMPLETE,           // 2
        REFUNDED,           // 3
        IN_DISPUTE          // 4
    }
    State public state;

    bool private _initialized; // Prevents re-initialisation on clones

    // Events
    event Initialized(address indexed buyer, address indexed seller, address indexed arbiter);
    event Deposited(address indexed buyer, uint256 amount);
    event Released(address indexed seller, uint256 amount);
    event Refunded(address indexed buyer, uint256 amount);
    event DisputeInitiated(address indexed initiator);
    event DisputeResolved(address indexed arbiter, bool refundBuyer, uint256 amount);
    event TimeoutClaimed(address indexed seller, uint256 amount);

    // Errors
    error AlreadyInitialized();
    error InvalidAddress();
    error Unauthorized();
    error WrongState();
    error DeadlineNotReached();
    error TransferFailed();
    error NoFunds();

    // Constructor locks the implementation contract so it cannot be used directly
    constructor() {
        _initialized = true;
    }

    // Initialises a fresh clone (Called by EscrowFactory)
    function initialize(address _buyer, address _seller, address _arbiter) external {
        if (_initialized) revert AlreadyInitialized();
        if (_buyer == address(0) || _seller == address(0) || _arbiter == address(0)) revert InvalidAddress();
        
        // Ensure all roles are distinct
        if (_buyer == _seller || _buyer == _arbiter || _seller == _arbiter) revert InvalidAddress();

        _initialized = true;
        buyer = _buyer;
        seller = _seller;
        arbiter = _arbiter;
        state = State.AWAITING_PAYMENT;

        emit Initialized(_buyer, _seller, _arbiter);
    }

    // Modifiers
    modifier onlyBuyer() {
        if (msg.sender != buyer) revert Unauthorized();
        _;
    }

    modifier onlySeller() {
        if (msg.sender != seller) revert Unauthorized();
        _;
    }

    modifier onlyArbiter() {
        if (msg.sender != arbiter) revert Unauthorized();
        _;
    }

    modifier inState(State expected) {
        if (state != expected) revert WrongState();
        _;
    }

    // Core Functions

    // Buyer funds the escrow and starts the timeout clock
    function deposit() external payable onlyBuyer inState(State.AWAITING_PAYMENT) {
        if (msg.value == 0) revert NoFunds();

        state = State.AWAITING_DELIVERY;
        deadline = block.timestamp + TIMEOUT;

        emit Deposited(msg.sender, msg.value);
    }

    // Buyer confirms delivery and releases funds to seller
    function release() external onlyBuyer inState(State.AWAITING_DELIVERY) {
        uint256 amount = address(this).balance;
        state = State.COMPLETE;
        _transfer(seller, amount);
        emit Released(seller, amount);
    }

    // Buyer or Seller can raise a dispute to freeze funds
    function initiateDispute() external inState(State.AWAITING_DELIVERY) {
        if (msg.sender != buyer && msg.sender != seller) revert Unauthorized();

        state = State.IN_DISPUTE;
        emit DisputeInitiated(msg.sender);
    }

    // Arbiter resolves dispute (true = refund buyer, false = pay seller)
    function resolveDispute(bool refundBuyer) external onlyArbiter inState(State.IN_DISPUTE) {
        uint256 amount = address(this).balance;

        if (refundBuyer) {
            state = State.REFUNDED;
            _transfer(buyer, amount);
            emit Refunded(buyer, amount);
        } else {
            state = State.COMPLETE;
            _transfer(seller, amount);
            emit Released(seller, amount);
        }

        emit DisputeResolved(msg.sender, refundBuyer, amount);
    }

    // Seller claims funds if buyer ghosts after the 7-day deadline
    function claimTimeout() external onlySeller inState(State.AWAITING_DELIVERY) {
        if (block.timestamp <= deadline) revert DeadlineNotReached();

        uint256 amount = address(this).balance;
        state = State.COMPLETE;
        _transfer(seller, amount);
        emit TimeoutClaimed(seller, amount);
    }

    // Internal eth transfer helper
    function _transfer(address recipient, uint256 amount) internal {
        (bool ok, ) = payable(recipient).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}

contract EscrowFactory {
    using Clones for address;

    address public immutable implementation;
    address[] public allEscrows;
    mapping(address => address[]) public escrowsByBuyer;

    event EscrowCreated(address indexed escrow, address indexed buyer, address indexed seller, address arbiter);

    constructor() {
        implementation = address(new Escrow());
    }

    // Deploy a new proxy Escrow
    function createEscrow(address _seller, address _arbiter) external returns (address escrow) {
        escrow = implementation.clone();
        Escrow(escrow).initialize(msg.sender, _seller, _arbiter);

        allEscrows.push(escrow);
        escrowsByBuyer[msg.sender].push(escrow);

        emit EscrowCreated(escrow, msg.sender, _seller, _arbiter);
    }

    function getEscrowCount() external view returns (uint256) {
        return allEscrows.length;
    }

    function getEscrowsByBuyer(address _buyer) external view returns (address[] memory) {
        return escrowsByBuyer[_buyer];
    }
}