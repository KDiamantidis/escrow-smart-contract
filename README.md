# Escrow Smart Contract (Ethereum) with Dispute Resolution & Factory

This project implements a secure, production-ready **Ethereum escrow smart contract** using **Solidity** and **Hardhat**. 

It uses the **Factory Pattern** with EIP-1167 Minimal Proxies (Clones) for extreme gas efficiency, and features a robust dispute resolution system with an independent Arbiter and seller-side timeouts.

## 🌟 Key Features
- **Gas Efficient:** Uses `@openzeppelin/contracts/proxy/Clones.sol` to deploy cheap clones instead of full contracts.
- **Arbiter Dispute Resolution:** Funds cannot be unilaterally refunded. A neutral third party (Arbiter) resolves deadlocks.
- **Seller Timeout Protection:** If the buyer receives the goods but "ghosts" the platform, the seller can claim the funds after a 7-day deadline.

## 👥 Participants
- `Buyer`: Creates the escrow via the Factory, designates the seller and arbiter, and deposits the funds.
- `Seller`: Delivers the product/service and receives the funds upon buyer approval or timeout.
- `Arbiter`: A neutral third-party address that steps in *only* if a dispute is raised.

## 🚥 States
1. `AWAITING_PAYMENT`: Contract deployed, waiting for the buyer to send ETH.
2. `AWAITING_DELIVERY`: Funds locked. Seller must deliver. 7-day timeout starts.
3. `COMPLETE`: Funds successfully released to the seller.
4. `REFUNDED`: Funds returned to the buyer (only via Arbiter).
5. `IN_DISPUTE`: Transaction frozen. Only the Arbiter can resolve it.

## 🔄 Contract Flow

1. **Creation:** Buyer calls `createEscrow(sellerAddress, arbiterAddress)` on the `EscrowFactory`.
2. **Deposit:** Buyer deposits ETH into their specific Escrow clone. State becomes `AWAITING_DELIVERY`.
3. **Resolution (3 Paths):**
   - **Happy Path:** Buyer is satisfied and calls `release()`. Seller gets paid.
   - **Dispute:** Something goes wrong. Buyer or Seller calls `initiateDispute()`. The Arbiter reviews off-chain and calls `resolveDispute(true/false)` to refund the buyer or pay the seller.
   - **Timeout:** 7 days pass without the buyer releasing funds or raising a dispute. Seller calls `claimTimeout()` to get paid.

## 🧪 Test Coverage

The project includes **35 comprehensive automated tests** written in TypeScript, covering:
- Factory deployment & clone isolation
- State transition constraints
- Access control (preventing unauthorized actions)
- Dispute edge-cases & Arbiter logic
- Time-travel tests for the 7-day `claimTimeout` fallback

To run the tests:
```bash
npx hardhat test