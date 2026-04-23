# Operations runbook

## Environments

| Environment | Chain        | Purpose        |
|------------|--------------|----------------|
| dev        | Hardhat 31337| Local dev      |
| staging    | Sepolia      | UAT / demos    |
| prod       | As configured| Live users     |

Record `EscrowFactory` addresses in [`deployments/`](../deployments/) after each deploy.

## Key compromise

1. Rotate compromised keys at the provider (RPC, Groq, etc.).
2. Update Vercel / CI secrets; redeploy.
3. If a deployer wallet was leaked, assume deployed contracts are untrusted; deploy new factory and update `NEXT_PUBLIC_FACTORY_ADDRESS`.

## Bad frontend deploy

1. In Vercel: **Deployments** → select last good deployment → **Promote to Production** (or redeploy that commit).
2. Fix forward on `main` after root cause is identified.

## RPC outage

- Symptoms: reads fail, wallet shows wrong chain errors.
- Actions: switch `NEXT_PUBLIC_RPC_URL` to backup provider; redeploy; verify `NEXT_PUBLIC_EXPLORER_URL` still matches chain.

## AI assistant outage

- Symptoms: 502 from `/api/assistant`, or empty streams.
- Actions: verify `GROQ_API_KEY` and quotas; check rate limits (`rate-limit` / Upstash); temporarily disable assistant UI if needed (feature flag or remove route — requires code change).

## On-call / severity (template)

- **P0**: funds at risk, auth bypass, private key in repo.
- **P1**: production down, cannot transact.
- **P2**: degraded UX, assistant only, non-prod.

Assign contacts and escalation in your team wiki.

## Error monitoring (Sentry)

This app uses **`@sentry/node`** (server / API routes) and **`@sentry/react`** (browser). `@sentry/nextjs` is not used because its peer dependency does not yet include Next.js 16.

Set in Vercel (or `.env.local`):

| Variable | Where |
|----------|--------|
| `SENTRY_DSN` | Server-side events (API routes, instrumentation). |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser (wallet / tx errors, global error boundary). |
| `SENTRY_TRACES_SAMPLE_RATE` / `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Optional; default `0.05`. |
| `SENTRY_ENVIRONMENT` / `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Optional; overrides `VERCEL_ENV` / `NODE_ENV` label. |

Without DSNs, Sentry calls are no-ops. See [PRODUCTION_PLAN_STATUS.md](./PRODUCTION_PLAN_STATUS.md).
