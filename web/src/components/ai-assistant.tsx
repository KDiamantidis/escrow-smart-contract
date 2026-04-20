"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SVGProps,
} from "react";
import { useAccount, useChainId } from "wagmi";

import { cn } from "@/lib/utils";
import { chainMeta, truncateAddress } from "@/lib/chain-meta";
import { checkInputSafety } from "@/lib/guardrails";
import { useAssistantContext } from "@/components/assistant-context";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "escrow-assistant:history:v1";
const STORAGE_VERSION = 1;
const MAX_PERSISTED = 40;

const GREETING: Message = {
  id: "greeting",
  role: "assistant",
  content:
    "Hi, I'm the Escrow Assistant. Ask me anything about deploying a deal, depositing, releasing, refunding, or disputing. I only help with this dApp — nothing else.",
};

const DEFAULT_SUGGESTIONS = [
  "How do I deploy a new deal?",
  "What does the arbiter do?",
  "My transaction failed — what now?",
  "When can the seller claim the timeout?",
];

const ROUTE_SUGGESTIONS: Record<string, string[]> = {
  "/": [
    "How do I deploy a new deal?",
    "What addresses do I need?",
    "Can the seller open a deal instead?",
  ],
  "/how-it-works": [
    "Walk me through step 2 (funding).",
    "What happens if we disagree?",
    "What is claimTimeout?",
  ],
  "/faq": [
    "Summarize the fees.",
    "Why can't I change the seller after deploy?",
    "Testnet vs mainnet — what am I using?",
  ],
  "/explore": [
    "Where can I see past deals?",
    "What does the block explorer show?",
  ],
  "/contributors": [
    "Who built this?",
    "How do I report an issue?",
  ],
};

/* ──────────────────────────── component ──────────────────────────── */

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prefersReduced = useReducedMotion();

  const { address } = useAccount();
  const chainId = useChainId();
  const pathname = usePathname();
  const meta = chainMeta(chainId);
  const { deal, suggestions: pageSuggestions } = useAssistantContext();

  /* ───── hydrate persisted history once on mount ───── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          v: number;
          messages: Message[];
        };
        if (parsed?.v === STORAGE_VERSION && Array.isArray(parsed.messages)) {
          setMessages(
            parsed.messages.length > 0 ? parsed.messages : [GREETING]
          );
        }
      }
    } catch {
      // ignore malformed storage
    }
    setHydrated(true);
  }, []);

  /* ───── persist history (capped) ───── */
  useEffect(() => {
    if (!hydrated) return;
    try {
      const trimmed = messages.slice(-MAX_PERSISTED);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ v: STORAGE_VERSION, messages: trimmed })
      );
    } catch {
      // ignore quota errors
    }
  }, [messages, hydrated]);

  /* ───── session context for the API ───── */
  const context = useMemo(
    () => ({
      path: pathname ?? undefined,
      account: address,
      chainId,
      chainLabel: meta.label,
      deal: deal
        ? {
            address: deal.address,
            stateIndex: deal.stateIndex,
            stateLabel: deal.stateLabel,
            role: deal.role,
            participants: deal.participants,
            notes: deal.notes,
          }
        : undefined,
    }),
    [pathname, address, chainId, meta.label, deal]
  );

  /* ───── suggestions: deal > page > default ───── */
  const suggestions = useMemo(() => {
    if (pageSuggestions && pageSuggestions.length > 0) return pageSuggestions;
    if (pathname && ROUTE_SUGGESTIONS[pathname]) {
      return ROUTE_SUGGESTIONS[pathname]!;
    }
    return DEFAULT_SUGGESTIONS;
  }, [pageSuggestions, pathname]);

  /* ───── keep scroll pinned, focus input, esc to close ───── */
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, sending, open]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /* ───── send ───── */
  const send = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || sending) return;
      setError(null);

      const guard = checkInputSafety(trimmed);

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
      };

      if (!guard.safe) {
        // Short-circuit: answer locally, do not hit the API.
        const safetyMsg: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: guard.assistantReply,
        };
        setMessages((prev) => [...prev, userMsg, safetyMsg]);
        setInput("");
        return;
      }

      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "",
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setSending(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const history = [...messages, userMsg]
          .filter((m) => m.id !== "greeting")
          .map(({ role, content }) => ({ role, content }));

        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, context }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          acc += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: acc } : m
            )
          );
        }

        if (!acc) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    content:
                      "I couldn't generate a reply. Please try again.",
                  }
                : m
            )
          );
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          setMessages((prev) =>
            prev.filter((m) => m.id !== assistantMsg.id)
          );
        } else {
          const msg =
            err instanceof Error ? err.message : "Something went wrong.";
          setError(msg);
          setMessages((prev) =>
            prev.filter((m) => m.id !== assistantMsg.id)
          );
        }
      } finally {
        abortRef.current = null;
        setSending(false);
      }
    },
    [context, messages, sending]
  );

  const stop = () => {
    abortRef.current?.abort();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const reset = () => {
    stop();
    setMessages([GREETING]);
    setError(null);
    setInput("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const onChatWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;

    const deltaY = e.deltaY;
    if (deltaY === 0) return;

    const atTop = el.scrollTop <= 0;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    const canScrollDown = deltaY > 0 && !atBottom;
    const canScrollUp = deltaY < 0 && !atTop;

    // Intercept only when chat can continue scrolling in wheel direction.
    if (canScrollDown || canScrollUp) {
      e.preventDefault();
      e.stopPropagation();
      el.scrollTop += deltaY;
    }
    // else: let event bubble so the page can scroll naturally.
  };

  const showEmptyHint = messages.length <= 1 && !sending;
  const dealChip = deal?.address
    ? {
        label: `Deal · ${deal.stateLabel ?? "…"}`,
        sub: `${truncateAddress(deal.address, 6, 4)}${
          deal.role && deal.role !== "disconnected"
            ? ` · you: ${deal.role}`
            : ""
        }`,
      }
    : null;

  return (
    <>
      <Launcher open={open} onOpen={() => setOpen(true)} />

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Escrow Assistant"
            initial={
              prefersReduced
                ? { opacity: 0 }
                : { opacity: 0, y: 16, scale: 0.98 }
            }
            animate={
              prefersReduced
                ? { opacity: 1 }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              prefersReduced
                ? { opacity: 0 }
                : { opacity: 0, y: 12, scale: 0.98 }
            }
            transition={{
              duration: prefersReduced ? 0.15 : 0.22,
              ease: "easeOut",
            }}
            className={cn(
              "fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 text-foreground shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md",
              "inset-x-3 bottom-3 max-h-[85dvh]",
              "sm:inset-auto sm:right-5 sm:bottom-24 sm:h-[34rem] sm:w-[23rem] sm:max-h-[75dvh]",
              "lg:right-6 lg:bottom-24 lg:h-[36rem] lg:w-[25rem]"
            )}
            style={{ transform: "translateZ(0)" }}
          >
            <Header
              onClose={() => setOpen(false)}
              onReset={reset}
              canReset={messages.length > 1 || error !== null}
            />

            {dealChip && <DealChip label={dealChip.label} sub={dealChip.sub} />}

            <div
              ref={scrollRef}
              onWheel={onChatWheel}
              className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm [scrollbar-gutter:stable]"
            >
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  streaming={
                    sending &&
                    m.role === "assistant" &&
                    m === messages[messages.length - 1]
                  }
                />
              ))}

              {showEmptyHint && (
                <div className="pt-1">
                  <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Try asking
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void send(s)}
                        className="group rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-left text-[13px] text-foreground/85 transition-colors hover:border-border hover:bg-background/70 hover:text-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
                >
                  {error}
                </div>
              )}
            </div>

            <Composer
              value={input}
              onChange={setInput}
              onKeyDown={onKeyDown}
              onSend={() => void send(input)}
              onStop={stop}
              sending={sending}
              textareaRef={textareaRef}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ──────────────────────────── subcomponents ──────────────────────────── */

function Launcher({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      aria-label="Open Escrow Assistant"
      aria-expanded={open}
      initial={false}
      animate={{ opacity: open ? 0 : 1, scale: open ? 0.92 : 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={{ pointerEvents: open ? "none" : "auto" }}
      className={cn(
        "fixed right-5 bottom-5 z-50 inline-flex h-14 items-center gap-2 rounded-full border border-border/70 bg-card/95 px-4 pr-5 text-sm font-medium text-foreground shadow-[0_14px_40px_-14px_rgba(0,0,0,0.8)] backdrop-blur-md",
        "hover:border-border hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "sm:right-6 sm:bottom-6"
      )}
    >
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
        <ChatIcon className="size-4" />
      </span>
      <span className="hidden sm:inline">Ask the Assistant</span>
      <span className="sm:hidden">Assistant</span>
    </motion.button>
  );
}

function Header({
  onClose,
  onReset,
  canReset,
}: {
  onClose: () => void;
  onReset: () => void;
  canReset: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
      <div className="min-w-0">
        <p className="font-heading text-sm font-semibold tracking-tight">
          Escrow Assistant
        </p>
        <p className="text-[11px] text-muted-foreground">
          Scoped to this dApp. Not financial or legal advice.
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onReset}
          disabled={!canReset}
          aria-label="Start a new chat"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          <RefreshIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close assistant"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CloseIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function DealChip({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-border/60 bg-background/30 px-4 py-2 text-[11px]">
      <span className="size-1.5 rounded-full bg-accent" aria-hidden />
      <span className="font-medium tracking-wide text-foreground/90">
        {label}
      </span>
      <span className="truncate text-muted-foreground">{sub}</span>
    </div>
  );
}

function MessageBubble({
  message,
  streaming,
}: {
  message: Message;
  streaming: boolean;
}) {
  const mine = message.role === "user";
  const text = message.content;
  return (
    <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap",
          mine
            ? "bg-primary text-primary-foreground"
            : "bg-background/60 text-foreground ring-1 ring-border/60"
        )}
      >
        {text || (streaming ? <TypingDots /> : " ")}
        {streaming && text ? <CaretBlink /> : null}
      </div>
    </div>
  );
}

function Composer({
  value,
  onChange,
  onKeyDown,
  onSend,
  onStop,
  sending,
  textareaRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStop: () => void;
  sending: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const disabled = !sending && value.trim().length === 0;
  return (
    <div className="border-t border-border/60 bg-background/40 px-3 py-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Ask about the escrow flow…"
          className={cn(
            "min-h-[38px] max-h-40 flex-1 resize-none rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/70",
            "focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          )}
        />
        {sending ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            className="inline-flex size-9 flex-shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive transition-colors hover:bg-destructive/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <StopIcon className="size-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={disabled}
            aria-label="Send"
            className={cn(
              "inline-flex size-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              disabled
                ? "bg-foreground/10 text-muted-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            <SendIcon className="size-4" />
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[10px] leading-tight tracking-wide text-muted-foreground">
        Press Enter to send · Shift + Enter for a new line
      </p>
    </div>
  );
}

function TypingDots() {
  return (
    <span
      className="inline-flex items-center gap-1 text-muted-foreground"
      aria-label="Assistant is typing"
    >
      <span className="size-1.5 animate-pulse rounded-full bg-current" />
      <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
      <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
    </span>
  );
}

function CaretBlink() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[2px] animate-pulse bg-current align-baseline"
    />
  );
}

/* ──────────────────────────── inline icons ──────────────────────────── */

function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function RefreshIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function SendIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function StopIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}


