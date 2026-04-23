import * as Sentry from "@sentry/node";

let initialized = false;

/**
 * Initialize Sentry for Node (API routes, RSC server). No-op without SENTRY_DSN.
 */
export function initServerSentry(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
    environment:
      process.env.VERCEL_ENV ?? process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  });
  initialized = true;
}

export { Sentry };
