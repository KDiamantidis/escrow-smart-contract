# Production plan — status vs repo

Cross-check of the **Production-Ready Escrow** plan (Cursor / team) against this repository.  
Legend: **Done** (υλοποιημένο εδώ) · **Partial** · **Manual** (διαδικασία/εργαλεία εκτός repo) · **Not planned in code** (χρειάζεται εξωτερικό σύστημα).

## Phase 1 — Security baseline (P0)

| Item | Status | Notes |
|------|--------|--------|
| Rotate leaked API/RPC keys | **Manual** | Operators: providers + Vercel; see [SECURITY.md](../SECURITY.md). |
| Env policy (no secrets in chat, prod in Vercel) | **Done** | [SECURITY.md](../SECURITY.md), [.gitleaks.toml](../.gitleaks.toml). |
| Secret scanning in CI | **Done** | `gitleaks` job in [.github/workflows/ci.yml](../.github/workflows/ci.yml). |
| Contract checklist (states, roles, timeouts) | **Partial** | [CONTRACT_SECURITY_CHECKLIST.md](./CONTRACT_SECURITY_CHECKLIST.md) — review/sign-off **Manual**. |
| Negative / edge tests | **Partial** | [test/Escrow.test.ts](../test/Escrow.test.ts) — factory zero-address / buyer==arbiter; extend as needed. |
| Freeze compiler + reproducible build | **Partial** | Solidity `0.8.28` in [hardhat.config.ts](../hardhat.config.ts); use `npm ci` + lockfiles; see [BUILD_REPRODUCIBILITY.md](./BUILD_REPRODUCIBILITY.md). |
| Internal / external review before mainnet | **Manual** | |

## Phase 2 — Environment & deployment (P0)

| Item | Status | Notes |
|------|--------|--------|
| dev / staging / prod matrix | **Done** | [RUNBOOK.md](./RUNBOOK.md) table; env contract in [SECURITY.md](../SECURITY.md). |
| Root vs `NEXT_PUBLIC_*` variables | **Done** | Documented; [scripts/validate-vercel-env.mjs](../scripts/validate-vercel-env.mjs). |
| Deployment manifest per network | **Done** | [scripts/deploy.ts](../scripts/deploy.ts) → `deployments/<slug>.json`; [deployments/README.md](../deployments/README.md). |
| Frontend from manifest, not ad-hoc | **Partial** | Env still set in Vercel; use [scripts/sync-deployment-env.mjs](../scripts/sync-deployment-env.mjs) to generate `NEXT_PUBLIC_*` from manifest after deploy. |
| Vercel: root = `web`, protected branch, checks | **Manual** | Documented in [CONTRIBUTING.md](../CONTRIBUTING.md). |
| Pre-deploy env validation | **Done** | `npm run validate:web-env`; CI runs it before web build. |

## Phase 3 — CI/CD (P0)

| Item | Status | Notes |
|------|--------|--------|
| PR: compile + test (root) | **Done** | [ci.yml](../.github/workflows/ci.yml) `contracts` job. |
| PR: web lint + typecheck + build | **Done** | `web` job: lint, `typecheck`, build. |
| Branch protection, no direct push, reviews | **Manual** | GitHub settings. |
| Tag releases + release notes + factory metadata | **Manual** | Process; record commit + `deployments/*.json` per release. |

## Phase 4 — Observability (P1)

| Item | Status | Notes |
|------|--------|--------|
| Sentry (browser + server) | **Partial** | Optional DSN: [web/src/lib/sentry/](../web/src/lib/sentry/), [instrumentation.ts](../web/src/instrumentation.ts); `@sentry/nextjs` not used (Next 16 peer conflict) — `@sentry/react` + `@sentry/node`. |
| Wallet / RPC / tx failures | **Partial** | Client captures in escrow flows; API logs in [assistant route](../web/src/app/api/assistant/route.ts). |
| On-chain index + dashboard metrics | **Not planned in code** | Needs indexer/subgraph/hosted analytics; outline in [ONCHAIN_TELEMETRY.md](./ONCHAIN_TELEMETRY.md). |
| Assistant: rate limits & guardrails | **Done** | Structured logs [server-log.ts](../web/src/lib/server-log.ts); streamed provider fallback in assistant route. |

## Phase 5 — Product & compliance (P1)

| Item | Status | Notes |
|------|--------|--------|
| UX / a11y pass (mobile flows) | **Manual** | No automated sign-off in repo. |
| Privacy + legal review | **Manual** | [privacy](../web/src/app/privacy/page.tsx); counsel review **Manual**. |
| ToS / risk disclaimer | **Done** | [terms](../web/src/app/terms/page.tsx) + nav. |
| Runbooks + on-call | **Partial** | [RUNBOOK.md](./RUNBOOK.md); fill contacts in your wiki. |

## Go-live acceptance (summary)

| Criterion | Status |
|-----------|--------|
| Tests green + checklist | **Partial** (sign-off **Manual**) |
| CI green on default branch | **Done** (when Actions enabled) |
| Reproducible deploy from tag | **Manual** (process + lockfiles) |
| Monitoring + tested alerting | **Partial** (Sentry optional; alerting **Manual**) |
| Key rotation / secrets policy | **Manual** |
| Staging soak test | **Manual** |
