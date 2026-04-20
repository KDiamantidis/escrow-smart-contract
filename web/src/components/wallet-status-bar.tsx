"use client";

import Link from "next/link";
import { useState } from "react";
import { Wallet } from "lucide-react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { SiteNavLinks } from "@/components/site-nav-links";
import { chainMeta, truncateAddress } from "@/lib/chain-meta";
import { SUPPORTED_CHAIN_IDS } from "@/lib/wagmi-config";
import { cn } from "@/lib/utils";

interface WalletStatusBarProps {
  /** When true, render with `position: fixed` over the page (overlay heroes). */
  overlay?: boolean;
  /** Optional left-aligned brand or title (e.g. on the detail page). */
  leftSlot?: React.ReactNode;
  className?: string;
}

export function WalletStatusBar({
  overlay = false,
  leftSlot,
  className,
}: WalletStatusBarProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectAsync, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const [error, setError] = useState<string | null>(null);

  const meta = chainMeta(chainId);
  const wrongChain = isConnected && !SUPPORTED_CHAIN_IDS.includes(chainId);

  const onConnect = async () => {
    setError(null);
    try {
      await connectAsync({ connector: injected() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect wallet");
    }
  };

  const onSwitch = async () => {
    setError(null);
    try {
      await switchChainAsync({ chainId: sepolia.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch network");
    }
  };

  return (
    <div
      data-slot="wallet-status-bar"
      className={cn(
        "z-40 w-full border-b border-border/60",
        overlay
          ? "fixed inset-x-0 top-0 bg-background/95 supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur-md"
          : "sticky top-0 bg-background",
        className
      )}
      style={overlay ? { transform: "translateZ(0)", willChange: "transform" } : undefined}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {leftSlot ?? (
            <Link
              href="/"
              className="font-heading text-sm font-medium tracking-tight text-foreground/90 hover:text-foreground"
            >
              Escrow
            </Link>
          )}
          <SiteNavLinks />
        </div>

        {isConnected && (
          <Badge
            variant="outline"
            className="hidden gap-1.5 border-border/70 px-2 sm:inline-flex"
          >
            <span className={cn("size-1.5 rounded-full", meta.dotClass)} aria-hidden />
            <span className="text-[11px] font-medium">{meta.short}</span>
          </Badge>
        )}

        {wrongChain && (
          <Button
            size="sm"
            variant="outline"
            onClick={onSwitch}
            disabled={isSwitching}
            className="hidden sm:inline-flex"
          >
            {isSwitching ? "Switching…" : "Switch to Sepolia"}
          </Button>
        )}

        {isConnected ? (
          <div className="flex items-center gap-1.5">
            <code className="hidden rounded-md bg-muted px-2 py-1 font-mono text-[11px] tracking-tight sm:inline-flex">
              {truncateAddress(address)}
            </code>
            {address && (
              <CopyButton value={address} ariaLabel="Copy wallet address" />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => disconnect()}
              className="hidden sm:inline-flex"
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={onConnect} disabled={isConnecting}>
            <Wallet className="size-3.5" />
            {isConnecting ? "Connecting…" : "Connect"}
          </Button>
        )}
      </div>

      {error && (
        <div
          role="status"
          aria-live="polite"
          className="border-t border-destructive/30 bg-destructive/10 px-4 py-1.5 text-center text-xs text-destructive"
        >
          {error}
        </div>
      )}
    </div>
  );
}
