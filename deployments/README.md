# Deployment registry

JSON files here are written by [`scripts/deploy.ts`](../scripts/deploy.ts) after a successful factory deploy.

- Filename pattern: `<network-slug>.json` (e.g. `sepolia.json`, `hardhat.json`).
- Treat addresses as **environment-specific**: never point production UI at a staging factory without explicit sign-off.

Example shape:

```json
{
  "network": "sepolia",
  "chainId": 11155111,
  "factoryAddress": "0x…",
  "deployer": "0x…",
  "deployedAt": "2026-04-20T12:00:00.000Z"
}
```
