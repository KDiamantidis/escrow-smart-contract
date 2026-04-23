# Security policy

## Secrets and environment variables

- Never commit private keys, API keys, or `.env` / `.env.local` files.
- Never paste production secrets in chat, screenshots, or public issues.
- Production secrets belong only in your host’s encrypted environment (e.g. Vercel Project Settings).
- If a key is exposed, **rotate it immediately** at the provider (Groq, Infura, Alchemy, etc.).

## Deployer vs end users

- **Deployer** (`SEPOLIA_PRIVATE_KEY` in root `.env`): used only for Hardhat deploy scripts. Not used by the web app.
- **End users**: connect with MetaMask (or similar); the app never receives their private keys.

## Reporting vulnerabilities

- Open a **private** security advisory or email the maintainers with reproduction steps and impact.
- Do not disclose exploitable details publicly until a fix is released.

## Dependency and contract review

- Run `npm audit` periodically in root and `web/`.
- Treat smart contract changes as high risk: tests, review, and tagged releases before production networks.
