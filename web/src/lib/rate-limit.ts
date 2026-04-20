/**
 * Pluggable fixed-window rate limiter.
 *
 * - If both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are present,
 *   we talk to Upstash via its REST API (no extra npm dependency). This is
 *   durable and horizontal-scale safe.
 * - Otherwise we fall back to an in-memory Map — fine for local dev and
 *   single-instance deployments, but not durable across cold starts.
 */

export interface RateLimitResult {
  /** True if the request is allowed through. */
  ok: boolean;
  /** Remaining requests in the current window (best-effort). */
  remaining: number;
  /** Unix ms when the current window resets. */
  resetAt: number;
}

export interface RateLimitOptions {
  /** Bucket identifier, usually derived from client IP. */
  key: string;
  /** Window size in seconds. */
  windowSeconds: number;
  /** Max requests per window. */
  max: number;
}

/* ───────────────── in-memory fallback ───────────────── */

const memory = new Map<string, { count: number; resetAt: number }>();

function memoryLimit({
  key,
  windowSeconds,
  max,
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowSeconds * 1000;
    memory.set(key, { count: 1, resetAt });
    return { ok: true, remaining: max - 1, resetAt };
  }
  if (entry.count >= max) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return {
    ok: true,
    remaining: Math.max(0, max - entry.count),
    resetAt: entry.resetAt,
  };
}

/* ───────────────── upstash REST ───────────────── */

interface UpstashConfig {
  url: string;
  token: string;
}

function upstashConfig(): UpstashConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

async function upstashPipeline(
  cfg: UpstashConfig,
  commands: Array<Array<string | number>>
): Promise<Array<{ result?: unknown; error?: string }>> {
  const res = await fetch(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash error: ${res.status}`);
  return (await res.json()) as Array<{ result?: unknown; error?: string }>;
}

async function upstashLimit(
  cfg: UpstashConfig,
  { key, windowSeconds, max }: RateLimitOptions
): Promise<RateLimitResult> {
  // INCR + EXPIRE in a single pipeline → atomic enough for fixed-window.
  const fullKey = `rl:${key}`;
  const [incr, _expire, ttl] = await upstashPipeline(cfg, [
    ["INCR", fullKey],
    ["EXPIRE", fullKey, windowSeconds, "NX"],
    ["PTTL", fullKey],
  ]);

  const count =
    typeof incr?.result === "number"
      ? incr.result
      : Number(incr?.result ?? 0);
  const pttlMs =
    typeof ttl?.result === "number"
      ? ttl.result
      : Number(ttl?.result ?? windowSeconds * 1000);

  const resetAt = Date.now() + (pttlMs > 0 ? pttlMs : windowSeconds * 1000);

  if (count > max) {
    return { ok: false, remaining: 0, resetAt };
  }
  return { ok: true, remaining: Math.max(0, max - count), resetAt };
}

/* ───────────────── public api ───────────────── */

export async function rateLimit(
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const cfg = upstashConfig();
  if (!cfg) return memoryLimit(opts);
  try {
    return await upstashLimit(cfg, opts);
  } catch {
    // If Upstash is unreachable, fail-open to in-memory rather than the whole
    // feature going down. This is a deliberate trade-off.
    return memoryLimit(opts);
  }
}
