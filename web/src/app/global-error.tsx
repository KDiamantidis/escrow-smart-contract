"use client";

import * as Sentry from "@sentry/react";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (dsn && !Sentry.getClient()) {
      Sentry.init({
        dsn,
        tracesSampleRate: Number(
          process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.05"
        ),
      });
    }
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-black px-4 py-16 text-center text-white">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-white/70">
          Try again or refresh the page. If the problem persists, check your network and wallet.
        </p>
        <button
          type="button"
          className="mt-6 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
          onClick={reset}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
