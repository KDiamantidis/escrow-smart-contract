# Contributing

## Branching and CI

- Open pull requests against `main`; avoid direct pushes to `main` if your team uses branch protection.
- Required checks (when GitHub Actions are enabled): Hardhat compile + tests, Next.js lint + typecheck + build.
- Keep commits focused; do not commit `.env`, `.env.local`, or keys.

## Local setup

1. Root: `npm install` then `npm run compile` and `npm run test`.
2. Web: `cd web && npm install && cp .env.example .env.local` and fill RPC / factory / explorer.
3. After Solidity changes: `npm run web:sync-abi` from repo root (after `npx hardhat compile`).

## Deploying contracts

- Use `npx hardhat run scripts/deploy.ts --network <network>`.
- Commit the generated file under `deployments/` for that network (see script output).
- Sync public env hints from a manifest: `npm run sync:deployment-env -- sepolia` (prints `NEXT_PUBLIC_FACTORY_ADDRESS` / explorer; set RPC separately).

## Production checklist

See [docs/PRODUCTION_PLAN_STATUS.md](docs/PRODUCTION_PLAN_STATUS.md) for plan vs repo status.

## Security

See [SECURITY.md](SECURITY.md) and [docs/CONTRACT_SECURITY_CHECKLIST.md](docs/CONTRACT_SECURITY_CHECKLIST.md).
