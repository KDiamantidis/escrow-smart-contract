/**
 * Lightweight, dependency-free heuristics to catch obvious secret-leakage in
 * user input before it hits the model. Intentionally conservative — we prefer
 * false positives (polite refusal) over leaking a private key to a provider.
 */

export type GuardrailReason =
  | "seed_phrase_keyword"
  | "possible_mnemonic"
  | "possible_private_key"
  | "possible_keystore"
  | "jailbreak_attempt";

export interface GuardrailResult {
  safe: boolean;
  reason?: GuardrailReason;
  /** Short, friendly reply to show when safe === false. */
  assistantReply: string;
}

const SAFE_REPLY_SECRET =
  "Please stop — never paste seed phrases, mnemonics, private keys or keystore JSON into any chat (including me). If you already sent one, move your funds to a new wallet as soon as possible. I'm happy to help with escrow usage instead.";

const SAFE_REPLY_JAILBREAK =
  "I can only help with this Escrow dApp. I won't switch personas or ignore my rules. If you have an escrow question, ask away.";

/* ───────────────────── patterns ───────────────────── */

const SEED_KEYWORDS =
  /\b(seed[\s-]?phrase|mnemonic|recovery[\s-]?phrase|passphrase|secret[\s-]?recovery[\s-]?phrase)\b/i;

// 64 hex chars (optionally prefixed with 0x) → very likely a private key.
const HEX_PRIVATE_KEY = /\b(0x)?[a-f0-9]{64}\b/i;

// Keystore JSON signature: has "crypto" + "ciphertext" + "kdf" nearby.
const KEYSTORE_HINT = /\bciphertext\b[\s\S]{0,200}\bkdf\b/i;

// Prompt-injection / jailbreak patterns.
const JAILBREAK =
  /\b(ignore (the )?(previous|above|all)|disregard (the )?(previous|above|all)|forget (the )?(previous|above|all|your)|you are now|act as|dan mode|developer mode|jailbreak|pretend you (are|have no))/i;

/* ───────────────────── BIP39-ish mnemonic heuristic ───────────────────── */

/**
 * We don't ship the 2048-word BIP39 list (too heavy for a client bundle).
 * Instead we flag any run of ≥ 11 consecutive "mnemonic-shaped" tokens:
 *   - lower-case ASCII letters only
 *   - length 3..8
 *   - separated by single whitespace
 * This covers 12/15/18/21/24-word phrases with very low false-positive rate
 * in normal English prose (it's rare to write 11 short all-lowercase words
 * in a row with no punctuation).
 */
function looksLikeMnemonic(input: string): boolean {
  const cleaned = input.replace(/[\t\r\n]+/g, " ").trim();
  if (!cleaned) return false;

  const tokens = cleaned.split(/\s+/);
  let run = 0;
  for (const t of tokens) {
    if (/^[a-z]{3,8}$/.test(t)) {
      run += 1;
      if (run >= 11) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

/* ───────────────────── public api ───────────────────── */

export function checkInputSafety(raw: string): GuardrailResult {
  const text = raw ?? "";

  if (SEED_KEYWORDS.test(text)) {
    if (looksLikeMnemonic(text) || HEX_PRIVATE_KEY.test(text)) {
      return {
        safe: false,
        reason: "possible_mnemonic",
        assistantReply: SAFE_REPLY_SECRET,
      };
    }
    return {
      safe: false,
      reason: "seed_phrase_keyword",
      assistantReply: SAFE_REPLY_SECRET,
    };
  }

  if (HEX_PRIVATE_KEY.test(text)) {
    return {
      safe: false,
      reason: "possible_private_key",
      assistantReply: SAFE_REPLY_SECRET,
    };
  }

  if (KEYSTORE_HINT.test(text)) {
    return {
      safe: false,
      reason: "possible_keystore",
      assistantReply: SAFE_REPLY_SECRET,
    };
  }

  if (looksLikeMnemonic(text)) {
    return {
      safe: false,
      reason: "possible_mnemonic",
      assistantReply: SAFE_REPLY_SECRET,
    };
  }

  if (JAILBREAK.test(text)) {
    return {
      safe: false,
      reason: "jailbreak_attempt",
      assistantReply: SAFE_REPLY_JAILBREAK,
    };
  }

  return { safe: true, assistantReply: "" };
}
