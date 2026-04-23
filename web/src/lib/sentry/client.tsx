"use client";

import * as Sentry from "@sentry/react";
import { useEffect } from "react";

let clientInitialized = false;

/**
 * One-time browser Sentry init. No-op without NEXT_PUBLIC_SENTRY_DSN.
 */
export function SentryClientInit() {
  useEffect(() => {
    if (clientInitialized) return;
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;

    Sentry.init({
      dsn,
      tracesSampleRate: Number(
        process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.05"
      ),
      environment:
        process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
        process.env.NEXT_PUBLIC_VERCEL_ENV ??
        process.env.NODE_ENV,
    });
    clientInitialized = true;
  }, []);

  return null;
}
