# Escrow Smart Contract (Ethereum)

This project implements a simple and secure **Ethereum escrow smart contract** using **Solidity** and **Hardhat 3**.

The goal is to ensure that:
- the **buyer** only pays if conditions are met
- the **seller** only gets paid after buyer approval
- funds are protected against misuse or incorrect state transitions

The contract is fully covered by **positive and negative tests**, validating both normal behavior and failure scenarios.

## Escrow Logic Overview

**Participants**
- `seller`: deploys the contract
- `buyer`: designated during deployment and performs the payment

**States**
1. `AWAITING_PAYMENT`
2. `AWAITING_DELIVERY`
3. `COMPLETE`
4. `REFUNDED`

State transitions are strictly enforced.

## Contract Flow

1. Seller deploys the contract and specifies the buyer
2. Buyer deposits ETH into the escrow
3. Buyer either:
   - releases funds to the seller, or
   - requests a refund
4. Contract reaches a final state (`COMPLETE` or `REFUNDED`)

Invalid actions revert.

## Test Coverage

The project includes **comprehensive automated tests**:

### Positive tests
- Contract deployment
- Buyer deposit
- Refund flow (with correct gas accounting)
- Release flow (seller receives ETH)

### Negative tests
- Non-buyer cannot deposit
- Double deposit is rejected
- Refund before deposit is rejected
- Release before deposit is rejected
- Refund after release is rejected

Tests are written using **node:test**, **ethers v6**, and **Hardhat 3**.

## How to Run

```bash
npm install
npx hardhat compile
npx hardhat test
