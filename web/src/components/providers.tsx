"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi-config";
import { AssistantProvider } from "@/components/assistant-context";
import { SentryClientInit } from "@/lib/sentry/client";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SentryClientInit />
        <AssistantProvider>{children}</AssistantProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
