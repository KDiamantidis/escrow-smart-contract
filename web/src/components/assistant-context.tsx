"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Context pushed by specific pages (e.g. the deal page). */
export interface AssistantDealContext {
  /** Contract address of the deal, if any. */
  address?: string;
  /** Numeric state 0..4. */
  stateIndex?: number;
  /** Human label of the state, e.g. "Awaiting payment". */
  stateLabel?: string;
  /** Role of the connected wallet for this specific deal. */
  role?: "buyer" | "seller" | "arbiter" | "observer" | "disconnected";
  /** Roles present on the deal — useful for role clarity in prompts. */
  participants?: {
    buyer?: string;
    seller?: string;
    arbiter?: string;
  };
  /** Optional free-form notes (e.g. "deadline in 3d"). */
  notes?: string;
}

interface AssistantContextValue {
  deal: AssistantDealContext | null;
  suggestions: string[] | null;
  setDealContext: (ctx: AssistantDealContext | null) => void;
  setSuggestions: (items: string[] | null) => void;
}

const Ctx = createContext<AssistantContextValue | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [deal, setDeal] = useState<AssistantDealContext | null>(null);
  const [suggestions, setSug] = useState<string[] | null>(null);

  const setDealContext = useCallback(
    (ctx: AssistantDealContext | null) => setDeal(ctx),
    []
  );
  const setSuggestions = useCallback(
    (items: string[] | null) => setSug(items),
    []
  );

  const value = useMemo<AssistantContextValue>(
    () => ({ deal, suggestions, setDealContext, setSuggestions }),
    [deal, suggestions, setDealContext, setSuggestions]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAssistantContext(): AssistantContextValue {
  const v = useContext(Ctx);
  if (!v) {
    // The widget may be rendered before the provider in some edge paths;
    // return a no-op shape so we don't throw.
    return {
      deal: null,
      suggestions: null,
      setDealContext: () => {},
      setSuggestions: () => {},
    };
  }
  return v;
}
