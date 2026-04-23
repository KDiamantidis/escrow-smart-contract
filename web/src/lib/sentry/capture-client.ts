"use client";

import * as Sentry from "@sentry/react";

function sentryEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/** Report unexpected client errors (RPC / wallet / tx) when Sentry DSN is set. */
export function captureClientException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!sentryEnabled()) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
