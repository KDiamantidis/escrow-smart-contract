export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initServerSentry } = await import("@/lib/sentry/server");
    initServerSentry();
  }
}
