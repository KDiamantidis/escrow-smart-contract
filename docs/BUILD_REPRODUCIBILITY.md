# Reproducible builds

## Contracts

- **Solidity**: version pinned in [hardhat.config.ts](../hardhat.config.ts) (`solidity.version`).
- Install: from repo root run `npm ci` (uses [package-lock.json](../package-lock.json)).
- Compile: `npm run compile`.
- Tests: `npm run test`.

## Web app

- From `web/`: `npm ci` ([web/package-lock.json](../web/package-lock.json)).
- Build: set public env vars (see [scripts/validate-vercel-env.mjs](../scripts/validate-vercel-env.mjs)) then `npm run build`.
- Typecheck only: `npm run typecheck`.

## Releases

Prefer tagging (`vX.Y.Z`) on the exact commit used for production, with [deployments/](../deployments/) manifest for that environment committed or attached to release notes.
