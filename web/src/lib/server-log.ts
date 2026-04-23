/**
 * One-line JSON logs for serverless/API routes (Vercel/host stdout).
 */
export function logServerEvent(
  source: string,
  event: string,
  data: Record<string, unknown> = {}
): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      source,
      event,
      ...data,
    })
  );
}
