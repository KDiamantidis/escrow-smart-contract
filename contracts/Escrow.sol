// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Escrow {
    // Participants
    address public buyer;
    address public seller;

    // Escrow state machine
    enum State {
        AWAITING_PAYMENT,
        AWAITING_DELIVERY,
        COMPLETE,
        REFUNDED
    }

    State public state;
    error InvalidBuyer();

    constructor(address _buyer) {
        if (_buyer == address(0)) revert InvalidBuyer();

        seller = msg.sender;
        buyer = _buyer;
        state = State.AWAITING_PAYMENT;
    }

    event Deposited(address indexed buyer, uint256 amount);
    event Refunded(address indexed buyer, uint256 amount);
    event Released(address indexed seller, uint256 amount);

    modifier onlyBuyer() {
        require(msg.sender == buyer, "Only buyer can call this");
        _;
    }

    modifier onlySeller() {
        require(msg.sender == seller, "Only seller can call this");
        _;
    }

    function deposit() external payable onlyBuyer {
        require(state == State.AWAITING_PAYMENT, "Payment already made");
        require(msg.value > 0, "Must send ETH");

        state = State.AWAITING_DELIVERY;

        emit Deposited(msg.sender, msg.value);
    }

    function refund() external onlyBuyer {
        require(state == State.AWAITING_DELIVERY, "Not refundable now");

        state = State.REFUNDED;

        uint256 amount = address(this).balance;

        (bool ok, ) = payable(buyer).call{value: amount}("");
        require(ok, "Refund failed");

        emit Refunded(buyer, amount);
    }

    function release() external onlyBuyer {
        require(state == State.AWAITING_DELIVERY, "Not releasable now");

        state = State.COMPLETE;

        uint256 amount = address(this).balance;

        (bool ok, ) = payable(seller).call{value: amount}("");
        require(ok, "Release failed");

        emit Released(seller, amount);
    }

}
