#!/usr/bin/env node
/**
 * Validates required public env vars before a production build (e.g. Vercel).
 * Run with the same env Vercel injects at build time.
 */
const required = [
  "NEXT_PUBLIC_RPC_URL",
  "NEXT_PUBLIC_FACTORY_ADDRESS",
  "NEXT_PUBLIC_EXPLORER_URL",
];

const optionalAssistant = ["GROQ_API_KEY"];

function isHexAddress(s) {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}

function isHttpUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

let failed = false;
for (const key of required) {
  const v = process.env[key];
  if (!v || !String(v).trim()) {
    console.error(`Missing required env: ${key}`);
    failed = true;
    continue;
  }
  if (key === "NEXT_PUBLIC_FACTORY_ADDRESS" && !isHexAddress(String(v).trim())) {
    console.error(`${key} must be a 0x-prefixed 40-hex address`);
    failed = true;
  }
  if (
    (key === "NEXT_PUBLIC_RPC_URL" || key === "NEXT_PUBLIC_EXPLORER_URL") &&
    !isHttpUrl(String(v).trim())
  ) {
    console.error(`${key} must be a valid http(s) URL`);
    failed = true;
  }
}

for (const key of optionalAssistant) {
  if (!process.env[key]) {
    console.warn(`Optional (assistant): ${key} not set — AI chat will fail at runtime.`);
  }
}

if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
  console.warn(
    "Optional (monitoring): SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN not set — error tracking disabled."
  );
}

if (failed) {
  process.exit(1);
}
console.log("validate-vercel-env: OK");
