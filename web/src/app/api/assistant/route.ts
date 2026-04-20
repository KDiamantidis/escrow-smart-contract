import { NextRequest } from "next/server";

import {
  ASSISTANT_SYSTEM_PROMPT,
  buildSessionContextMessage,
  type AssistantSessionContext,
} from "@/lib/assistant-prompt";
import { checkInputSafety } from "@/lib/guardrails";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ───────────────────────── request shape ───────────────────────── */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AssistantRequestBody {
  messages?: ChatMessage[];
  context?: AssistantSessionContext;
}

/* ───────────────────────── constants ───────────────────────── */

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

const MAX_MESSAGES = 24;
const MAX_CONTENT_CHARS = 4000;

const RATE_WINDOW_SECONDS = 60;
const RATE_MAX_PER_WINDOW = 20;

/* ───────────────────────── helpers ───────────────────────── */

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "anon"
  );
}

function safetyStream(reply: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(reply));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Assistant-Guardrail": "1",
    },
  });
}

/* ───────────────────────── handler ───────────────────────── */

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Assistant is not configured. Missing GROQ_API_KEY." },
      { status: 500 }
    );
  }

  const limit = await rateLimit({
    key: clientIp(req),
    windowSeconds: RATE_WINDOW_SECONDS,
    max: RATE_MAX_PER_WINDOW,
  });
  if (!limit.ok) {
    return Response.json(
      {
        error:
          "Too many requests. Slow down and try again in a minute.",
        resetAt: limit.resetAt,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))
          ),
          "X-RateLimit-Remaining": String(limit.remaining),
        },
      }
    );
  }

  let body: AssistantRequestBody;
  try {
    body = (await req.json()) as AssistantRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const trimmed = incoming
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_CONTENT_CHARS),
    }));

  if (trimmed.length === 0) {
    return Response.json(
      { error: "Need at least one user message." },
      { status: 400 }
    );
  }

  // Server-side guardrail defense-in-depth: inspect the latest user message.
  const lastUser = [...trimmed].reverse().find((m) => m.role === "user");
  if (lastUser) {
    const verdict = checkInputSafety(lastUser.content);
    if (!verdict.safe) {
      return safetyStream(verdict.assistantReply);
    }
  }

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: ASSISTANT_SYSTEM_PROMPT },
  ];

  const ctxMessage = buildSessionContextMessage(body.context);
  if (ctxMessage) messages.push({ role: "system", content: ctxMessage });

  messages.push(...trimmed);

  const upstream = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || DEFAULT_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 700,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return Response.json(
      {
        error: "Upstream error from the AI provider.",
        status: upstream.status,
        detail: detail.slice(0, 500),
      },
      { status: 502 }
    );
  }

  /*
   * Groq returns SSE in OpenAI's format. We translate it into a simple
   * plain-text stream of deltas, so the client can just .read() chunks.
   */
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              // Ignore malformed chunks; keep streaming.
            }
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `\n\n[assistant error: ${
              err instanceof Error ? err.message : "stream interrupted"
            }]`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-RateLimit-Remaining": String(limit.remaining),
    },
  });
}
