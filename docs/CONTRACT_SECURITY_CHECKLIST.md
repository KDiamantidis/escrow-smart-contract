# Contract security checklist (pre-release)

Use this before tagging a release or deploying to a public network. Sign off in your release notes.

## Roles and state machine

- [ ] Buyer, seller, and arbiter are distinct and non-zero at `initialize`.
- [ ] Implementation contract cannot be used as a normal escrow (constructor locks `_initialized`).
- [ ] Clones cannot be initialized twice (`AlreadyInitialized`).
- [ ] State transitions match the intended flow: payment → delivery → complete/refund/dispute.

## Access control

- [ ] Only buyer can `deposit` in `AWAITING_PAYMENT`.
- [ ] Only buyer can `release` in `AWAITING_DELIVERY`.
- [ ] Buyer or seller can `initiateDispute`; third parties cannot.
- [ ] Only arbiter can `resolveDispute` in `IN_DISPUTE`.
- [ ] Only seller can `claimTimeout` after deadline in `AWAITING_DELIVERY`.

## Funds and transfers

- [ ] Zero-value `deposit` reverts (`NoFunds`).
- [ ] All outgoing ETH uses `call` with revert on failure (`TransferFailed`).
- [ ] No path leaves ETH stranded in a non-terminal state without documented behavior.

## Factory

- [ ] `createEscrow` passes distinct roles into `initialize` (factory enforces via Escrow).
- [ ] Event `EscrowCreated` emitted with correct indexed fields for indexers.

## Testing

- [ ] Full test suite green: `npm run test`
- [ ] New edge cases covered in [`test/Escrow.test.ts`](../test/Escrow.test.ts).

## Optional (mainnet)

- [ ] External audit or second independent review.
- [ ] Bug bounty / monitoring on factory and high-value escrows.
