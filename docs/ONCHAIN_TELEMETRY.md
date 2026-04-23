# On-chain telemetry (out of repo)

The production plan calls for **event indexing** and **dashboards** (deploy success rate, tx failure rate, confirmation latency). That is not implemented inside this Next.js app; it requires a dedicated data pipeline.

## Practical options

1. **Hosted indexer** (Goldsky, Envio, Alchemy subgraphs, etc.) subscribing to `EscrowFactory` and `Escrow` events.
2. **Block explorer + exports** for ad-hoc analysis (OK for low volume).
3. **Client-side-only metrics** (limited): you can log anonymized counters to your backend or Sentry from the dApp; they will not cover users who abandon before sending a tx.

## Events to index (minimum)

- `EscrowCreated` on the factory (deploy funnel).
- `Escrow` state-changing events / transactions you care about (deposit, release, dispute, resolve, timeout), depending on what the contracts emit.

See [CONTRACT_SECURITY_CHECKLIST.md](./CONTRACT_SECURITY_CHECKLIST.md) for event expectations.
