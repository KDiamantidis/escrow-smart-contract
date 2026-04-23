#!/usr/bin/env node
/**
 * Print NEXT_PUBLIC_* lines from a deployment manifest for Vercel / .env.local.
 * Usage (repo root): node scripts/sync-deployment-env.mjs [sepolia|hardhat|mainnet|chain-NNN]
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const slug = process.argv[2] ?? "sepolia";
const file = join(process.cwd(), "deployments", `${slug}.json`);

if (!existsSync(file)) {
  console.error(`sync-deployment-env: missing ${file} — deploy first with hardhat.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(file, "utf8"));
const { factoryAddress, chainId } = manifest;

if (!factoryAddress || typeof chainId !== "number") {
  console.error("sync-deployment-env: manifest missing factoryAddress or chainId");
  process.exit(1);
}

const EXPLORER_BY_CHAIN = {
  1: "https://etherscan.io",
  11155111: "https://sepolia.etherscan.io",
};

const explorer = EXPLORER_BY_CHAIN[chainId];
console.log(`# Generated from deployments/${slug}.json`);
console.log(`NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}`);
if (explorer) {
  console.log(`NEXT_PUBLIC_EXPLORER_URL=${explorer}`);
}
console.log(
  "# Set NEXT_PUBLIC_RPC_URL to an https RPC for this chain (not written here — keep keys out of repo)."
);
