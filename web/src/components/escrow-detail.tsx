"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { BaseError, decodeErrorResult, isAddress, parseEther } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSimulateContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletStatusBar } from "@/components/wallet-status-bar";
import { escrowAbi } from "@/lib/escrow-artifact";
import { truncateAddress } from "@/lib/chain-meta";
import { captureClientException } from "@/lib/sentry/capture-client";
import { cn } from "@/lib/utils";
import { useAssistantContext } from "@/components/assistant-context";

const STATE_LABELS = [
  "Awaiting payment",
  "Awaiting delivery",
  "Complete",
  "Refunded",
  "In dispute",
] as const;

type ActionKey =
  | "deposit"
  | "release"
  | "dispute"
  | "resolveSeller"
  | "resolveBuyer";

const TX_STATUS_LABELS: Record<ActionKey, string> = {
  deposit: "Deposit",
  release: "Release",
  dispute: "Open dispute",
  resolveSeller: "Resolve to seller",
  resolveBuyer: "Resolve to buyer",
};

function extractRevertData(err: unknown): `0x${string}` | undefined {
  let cur: unknown = err;
  const seen = new Set<unknown>();
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    const o = cur as { data?: unknown; details?: unknown; cause?: unknown };
    if (typeof o.data === "string" && /^0x[0-9a-fA-F]+$/.test(o.data)) {
      return o.data as `0x${string}`;
    }
    if (typeof o.details === "string" && /^0x[0-9a-fA-F]+$/.test(o.details)) {
      return o.details as `0x${string}`;
    }
    cur = o.cause;
  }
  return undefined;
}

function humanizeSimulateError(err: unknown): string {
  const data = extractRevertData(err);
  if (data) {
    try {
      const decoded = decodeErrorResult({ abi: escrowAbi, data });
      return decoded.errorName;
    } catch {
      /* fall through */
    }
  }
  if (err instanceof BaseError) {
    const m = err.shortMessage ?? err.message;
    return /^0x[0-9a-fA-F]+$/.test(m.trim())
      ? "This transaction would revert on-chain."
      : m;
  }
  if (err instanceof Error) {
    const m = err.message;
    return /^0x[0-9a-fA-F]+$/.test(m.trim())
      ? "This transaction would revert on-chain."
      : m;
  }
  return "This transaction would revert on-chain.";
}

function humanizeWriteError(err: unknown): string {
  const data = extractRevertData(err);
  if (data) {
    try {
      const decoded = decodeErrorResult({ abi: escrowAbi, data });
      return decoded.errorName;
    } catch {
      /* fall through */
    }
  }
  if (err instanceof BaseError) {
    const m = err.shortMessage ?? err.message;
    return /^0x[0-9a-fA-F]+$/.test(m.trim())
      ? "Transaction failed."
      : m;
  }
  if (err instanceof Error) {
    const m = err.message;
    return /^0x[0-9a-fA-F]+$/.test(m.trim()) ? "Transaction failed." : m;
  }
  return "Transaction failed.";
}

interface ActionConfig {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  confirmVariant: "default" | "destructive" | "secondary";
}

function explorerBase(): string {
  return (
    process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://sepolia.etherscan.io"
  ).replace(/\/$/, "");
}

function AddressRow({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | undefined;
  loading: boolean;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {loading || !value ? (
        <Skeleton className="h-4 w-full max-w-xs" />
      ) : (
        <div className="flex items-center gap-1.5">
          <code className="break-all rounded-md bg-muted px-2 py-1 font-mono text-xs">
            {value}
          </code>
          <CopyButton value={value} ariaLabel={`Copy ${label} address`} />
        </div>
      )}
    </div>
  );
}

export function EscrowDetail() {
  const params = useParams();
  const raw = params.address;
  const contractAddress =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const wrongChain = isConnected && chainId !== sepolia.id;
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const [depositEth, setDepositEth] = useState("0.01");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionKey | null>(null);
  const lastTxLabelRef = useRef("");

  const validAddress = useMemo(
    () => isAddress(contractAddress),
    [contractAddress]
  );

  const escrowAddr = validAddress ? (contractAddress as `0x${string}`) : undefined;

  const {
    data: buyerData,
    refetch: refetchBuyer,
    isLoading: isBuyerContractLoading,
  } = useReadContract({
    address: escrowAddr,
    abi: escrowAbi,
    functionName: "buyer",
    query: {
      enabled: !!escrowAddr && !wrongChain,
      refetchInterval: 12_000,
    },
  });
  const {
    data: sellerData,
    refetch: refetchSeller,
    isLoading: isSellerContractLoading,
  } = useReadContract({
    address: escrowAddr,
    abi: escrowAbi,
    functionName: "seller",
    query: {
      enabled: !!escrowAddr && !wrongChain,
      refetchInterval: 12_000,
    },
  });
  const {
    data: arbiterData,
    refetch: refetchArbiter,
    isLoading: isArbiterContractLoading,
  } = useReadContract({
    address: escrowAddr,
    abi: escrowAbi,
    functionName: "arbiter",
    query: {
      enabled: !!escrowAddr && !wrongChain,
      refetchInterval: 12_000,
    },
  });
  const {
    data: stateData,
    refetch: refetchState,
    isLoading: isStateContractLoading,
  } = useReadContract({
    address: escrowAddr,
    abi: escrowAbi,
    functionName: "state",
    query: {
      enabled: !!escrowAddr && !wrongChain,
      refetchInterval: 12_000,
    },
  });

  const buyer = buyerData as string | undefined;
  const seller = sellerData as string | undefined;
  const arbiter = arbiterData as string | undefined;
  const state = stateData;

  const refetchAll = useCallback(async () => {
    await Promise.all([
      refetchBuyer(),
      refetchSeller(),
      refetchArbiter(),
      refetchState(),
    ]);
  }, [refetchBuyer, refetchSeller, refetchArbiter, refetchState]);

  const isBuyer =
    !!address && !!buyer && address.toLowerCase() === buyer.toLowerCase();
  const isSeller =
    !!address && !!seller && address.toLowerCase() === seller.toLowerCase();
  const isArbiter =
    !!address && !!arbiter && address.toLowerCase() === arbiter.toLowerCase();

  const stateIdx = state !== undefined ? Number(state) : -1;
  const stateLabel =
    stateIdx >= 0 && stateIdx < STATE_LABELS.length
      ? STATE_LABELS[stateIdx]
      : "…";

  const role: "buyer" | "seller" | "arbiter" | "observer" | "disconnected" =
    !isConnected
      ? "disconnected"
      : isBuyer
        ? "buyer"
        : isSeller
          ? "seller"
          : isArbiter
            ? "arbiter"
            : "observer";

  const depositWei = useMemo(() => {
    try {
      return parseEther(depositEth || "0");
    } catch {
      return BigInt(0);
    }
  }, [depositEth]);

  const fallbackAddr = "0x0000000000000000000000000000000000000000" as const;

  const depositSimEnabled =
    !!escrowAddr &&
    !wrongChain &&
    pendingAction === "deposit" &&
    stateIdx === 0 &&
    isBuyer &&
    depositWei > BigInt(0);

  const releaseSimEnabled =
    !!escrowAddr &&
    !wrongChain &&
    pendingAction === "release" &&
    stateIdx === 1 &&
    isBuyer;

  const disputeSimEnabled =
    !!escrowAddr &&
    !wrongChain &&
    pendingAction === "dispute" &&
    stateIdx === 1 &&
    isBuyer;

  const resolveSellerSimEnabled =
    !!escrowAddr &&
    !wrongChain &&
    pendingAction === "resolveSeller" &&
    stateIdx === 4 &&
    isArbiter;

  const resolveBuyerSimEnabled =
    !!escrowAddr &&
    !wrongChain &&
    pendingAction === "resolveBuyer" &&
    stateIdx === 4 &&
    isArbiter;

  const depositSim = useSimulateContract({
    address: escrowAddr ?? fallbackAddr,
    abi: escrowAbi,
    functionName: "deposit",
    value: depositWei,
    query: { enabled: depositSimEnabled },
  });

  const releaseSim = useSimulateContract({
    address: escrowAddr ?? fallbackAddr,
    abi: escrowAbi,
    functionName: "release",
    query: { enabled: releaseSimEnabled },
  });

  const disputeSim = useSimulateContract({
    address: escrowAddr ?? fallbackAddr,
    abi: escrowAbi,
    functionName: "initiateDispute",
    query: { enabled: disputeSimEnabled },
  });

  const resolveSellerSim = useSimulateContract({
    address: escrowAddr ?? fallbackAddr,
    abi: escrowAbi,
    functionName: "resolveDispute",
    args: [false],
    query: { enabled: resolveSellerSimEnabled },
  });

  const resolveBuyerSim = useSimulateContract({
    address: escrowAddr ?? fallbackAddr,
    abi: escrowAbi,
    functionName: "resolveDispute",
    args: [true],
    query: { enabled: resolveBuyerSimEnabled },
  });

  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  const txBusy = isPending || isConfirming;

  useWatchContractEvent({
    address: escrowAddr,
    abi: escrowAbi,
    eventName: "Deposited",
    enabled: !!escrowAddr && !wrongChain,
    onLogs: () => {
      if (!txBusy) void refetchAll();
    },
  });
  useWatchContractEvent({
    address: escrowAddr,
    abi: escrowAbi,
    eventName: "DisputeInitiated",
    enabled: !!escrowAddr && !wrongChain,
    onLogs: () => {
      if (!txBusy) void refetchAll();
    },
  });
  useWatchContractEvent({
    address: escrowAddr,
    abi: escrowAbi,
    eventName: "DisputeResolved",
    enabled: !!escrowAddr && !wrongChain,
    onLogs: () => {
      if (!txBusy) void refetchAll();
    },
  });
  useWatchContractEvent({
    address: escrowAddr,
    abi: escrowAbi,
    eventName: "Initialized",
    enabled: !!escrowAddr && !wrongChain,
    onLogs: () => {
      if (!txBusy) void refetchAll();
    },
  });
  useWatchContractEvent({
    address: escrowAddr,
    abi: escrowAbi,
    eventName: "Refunded",
    enabled: !!escrowAddr && !wrongChain,
    onLogs: () => {
      if (!txBusy) void refetchAll();
    },
  });
  useWatchContractEvent({
    address: escrowAddr,
    abi: escrowAbi,
    eventName: "Released",
    enabled: !!escrowAddr && !wrongChain,
    onLogs: () => {
      if (!txBusy) void refetchAll();
    },
  });
  useWatchContractEvent({
    address: escrowAddr,
    abi: escrowAbi,
    eventName: "TimeoutClaimed",
    enabled: !!escrowAddr && !wrongChain,
    onLogs: () => {
      if (!txBusy) void refetchAll();
    },
  });

  const pickSim = (key: ActionKey | null) => {
    switch (key) {
      case "deposit":
        return depositSim;
      case "release":
        return releaseSim;
      case "dispute":
        return disputeSim;
      case "resolveSeller":
        return resolveSellerSim;
      case "resolveBuyer":
        return resolveBuyerSim;
      default:
        return null;
    }
  };

  const activeSim = pendingAction ? pickSim(pendingAction) : null;
  const simBusy = !!activeSim?.isFetching;
  const dialogBusy = txBusy || simBusy;

  const { setDealContext, setSuggestions } = useAssistantContext();

  useEffect(() => {
    if (!pendingAction) return;
    resetWrite();
    setError(null);
  }, [pendingAction, resetWrite]);

  useEffect(() => {
    if (!writeError) return;
    captureClientException(writeError, { flow: "escrow_tx_write" });
    setError(humanizeWriteError(writeError));
    setStatus(null);
    setPendingAction(null);
    resetWrite();
  }, [writeError, resetWrite]);

  useEffect(() => {
    if (!pendingAction) return;
    const err =
      pendingAction === "deposit"
        ? depositSim.error
        : pendingAction === "release"
          ? releaseSim.error
          : pendingAction === "dispute"
            ? disputeSim.error
            : pendingAction === "resolveSeller"
              ? resolveSellerSim.error
              : pendingAction === "resolveBuyer"
                ? resolveBuyerSim.error
                : undefined;
    if (!err) return;
    captureClientException(err, {
      flow: "escrow_simulate",
      action: pendingAction,
    });
    setError(humanizeSimulateError(err));
  }, [
    pendingAction,
    depositSim.error,
    releaseSim.error,
    disputeSim.error,
    resolveSellerSim.error,
    resolveBuyerSim.error,
  ]);

  useEffect(() => {
    if (!txHash) return;
    const label = lastTxLabelRef.current;
    setStatus(`${label} broadcast. Waiting for confirmation…`);
  }, [txHash]);

  useEffect(() => {
    if (!isConfirmed) return;
    const label = lastTxLabelRef.current;
    void (async () => {
      await refetchAll();
      setStatus(`${label} confirmed.`);
      setPendingAction(null);
      resetWrite();
    })();
  }, [isConfirmed, refetchAll, resetWrite]);

  useEffect(() => {
    if (!validAddress) return;
    setDealContext({
      address: contractAddress,
      stateIndex: stateIdx >= 0 ? stateIdx : undefined,
      stateLabel: stateIdx >= 0 ? stateLabel : undefined,
      role,
      participants: { buyer, seller, arbiter },
    });

    const hints = buildDealSuggestions(stateIdx, role);
    setSuggestions(hints);

    return () => {
      setDealContext(null);
      setSuggestions(null);
    };
  }, [
    validAddress,
    contractAddress,
    stateIdx,
    stateLabel,
    role,
    buyer,
    seller,
    arbiter,
    setDealContext,
    setSuggestions,
  ]);

  const ACTION_CONFIG: Record<ActionKey, ActionConfig> = {
    deposit: {
      title: "Deposit ETH into escrow?",
      description: (
        <>
          You are about to send <strong>{depositEth || "0"} ETH</strong> to the
          escrow contract. Funds can only be released to the seller or returned
          via dispute resolution.
        </>
      ),
      confirmLabel: `Deposit ${depositEth || "0"} ETH`,
      confirmVariant: "default",
    },
    release: {
      title: "Release funds to the seller?",
      description:
        "This sends the escrowed ETH to the seller and closes the deal. This action cannot be undone on chain.",
      confirmLabel: "Release to seller",
      confirmVariant: "default",
    },
    dispute: {
      title: "Open a dispute?",
      description:
        "The escrow moves into a disputed state until the arbiter resolves it in favor of the buyer or seller.",
      confirmLabel: "Open dispute",
      confirmVariant: "destructive",
    },
    resolveSeller: {
      title: "Resolve dispute in favor of the seller?",
      description:
        "The arbiter sends the escrowed ETH to the seller and closes the deal.",
      confirmLabel: "Send funds to seller",
      confirmVariant: "default",
    },
    resolveBuyer: {
      title: "Resolve dispute in favor of the buyer?",
      description:
        "The arbiter refunds the escrowed ETH to the buyer and closes the deal.",
      confirmLabel: "Refund the buyer",
      confirmVariant: "default",
    },
  };

  if (!validAddress) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <WalletStatusBar />
        <div className="container mx-auto max-w-lg space-y-6 px-4 py-16">
          <Alert variant="destructive">
            <AlertTitle>Invalid contract address</AlertTitle>
            <AlertDescription>
              The URL must end with a valid escrow contract address (
              <span className="font-mono text-xs">/escrow/0x…</span>).
            </AlertDescription>
          </Alert>
          <Link href="/" className={cn(buttonVariants(), "inline-flex")}>
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const dialogConfig = pendingAction ? ACTION_CONFIG[pendingAction] : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WalletStatusBar
        leftSlot={
          <Link
            href="/"
            className="font-heading text-sm font-medium tracking-tight text-foreground/90 hover:text-foreground"
          >
            ← Escrow
          </Link>
        }
      />

      <div className="container mx-auto max-w-2xl space-y-8 px-4 py-10">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Escrow deal
            </h1>
            {isStateContractLoading ? (
              <Skeleton className="h-5 w-28" />
            ) : (
              <Badge variant="outline">{stateLabel}</Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
              {truncateAddress(contractAddress, 10, 8)}
            </code>
            <CopyButton value={contractAddress} ariaLabel="Copy contract address" />
            <a
              href={`${explorerBase()}/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "gap-1.5"
              )}
            >
              Explorer
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Parties</CardTitle>
            <CardDescription>
              Roles are immutable for the lifetime of this contract.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddressRow
              label="Buyer"
              value={buyer}
              loading={isBuyerContractLoading}
            />
            <AddressRow
              label="Seller"
              value={seller}
              loading={isSellerContractLoading}
            />
            <AddressRow
              label="Arbiter"
              value={arbiter}
              loading={isArbiterContractLoading}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Your role
              {isConnected && (
                <span className="flex flex-wrap gap-1.5">
                  {isBuyer && <Badge>Buyer</Badge>}
                  {isSeller && <Badge variant="secondary">Seller</Badge>}
                  {isArbiter && <Badge variant="secondary">Arbiter</Badge>}
                  {!isBuyer && !isSeller && !isArbiter && (
                    <Badge variant="outline">Observer</Badge>
                  )}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Your role is inferred by comparing the connected wallet against
              the buyer, seller, and arbiter addresses above.
            </CardDescription>
          </CardHeader>
          {wrongChain && (
            <CardContent>
              <Alert variant="destructive">
                <AlertTitle>Wrong network</AlertTitle>
                <AlertDescription>
                  Switch your wallet to Sepolia using the top status bar to
                  interact with this contract.
                </AlertDescription>
                <div className="mt-3">
                  <Button
                    variant="destructive"
                    disabled={isSwitching}
                    onClick={() => switchChain({ chainId: sepolia.id })}
                  >
                    {isSwitching ? "Switching…" : "Switch to Sepolia"}
                  </Button>
                </div>
              </Alert>
            </CardContent>
          )}
        </Card>

        {isConnected && !wrongChain && (
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>
                Each button is enabled only when your wallet has the right role
                and the deal is in the right state.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isStateContractLoading && (
                <div className="space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-1/2" />
                </div>
              )}

              {!isStateContractLoading && stateIdx === 0 && (
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="amt"
                  >
                    Deposit amount (ETH)
                  </label>
                  <Input
                    id="amt"
                    inputMode="decimal"
                    value={depositEth}
                    onChange={(e) => setDepositEth(e.target.value)}
                    disabled={txBusy}
                    className="font-mono"
                  />
                  <Button
                    disabled={!isBuyer || txBusy || !depositEth}
                    onClick={() => setPendingAction("deposit")}
                  >
                    Deposit ETH
                  </Button>
                  {!isBuyer && (
                    <p className="text-xs text-muted-foreground">
                      Connect as the buyer wallet to deposit.
                    </p>
                  )}
                </div>
              )}

              {!isStateContractLoading && stateIdx === 1 && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    disabled={!isBuyer || txBusy}
                    onClick={() => setPendingAction("release")}
                  >
                    Release to seller
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!isBuyer || txBusy}
                    onClick={() => setPendingAction("dispute")}
                  >
                    Open dispute
                  </Button>
                  {!isBuyer && (
                    <p className="text-xs text-muted-foreground sm:self-center">
                      Only the buyer can release or open a dispute.
                    </p>
                  )}
                </div>
              )}

              {!isStateContractLoading && stateIdx === 4 && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    disabled={!isArbiter || txBusy}
                    onClick={() => setPendingAction("resolveSeller")}
                  >
                    Resolve to seller
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!isArbiter || txBusy}
                    onClick={() => setPendingAction("resolveBuyer")}
                  >
                    Resolve to buyer
                  </Button>
                  {!isArbiter && (
                    <p className="text-xs text-muted-foreground sm:self-center">
                      Only the arbiter can resolve a dispute.
                    </p>
                  )}
                </div>
              )}

              {!isStateContractLoading && (stateIdx === 2 || stateIdx === 3) && (
                <p className="text-sm text-muted-foreground">
                  This escrow is finished ({stateLabel}). No further on-chain
                  actions are possible.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Separator />

        <div
          role="status"
          aria-live="polite"
          className="space-y-3"
        >
          {status && (
            <Alert>
              <AlertTitle>Transaction</AlertTitle>
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="break-words">
                {error}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {dialogConfig && (
        <ConfirmDialog
          open={pendingAction !== null}
          onOpenChange={(open) => {
            if (!open && !txBusy) setPendingAction(null);
          }}
          title={dialogConfig.title}
          description={dialogConfig.description}
          confirmLabel={dialogConfig.confirmLabel}
          confirmVariant={dialogConfig.confirmVariant}
          busy={dialogBusy}
          onConfirm={() => {
            if (!pendingAction || !escrowAddr) return;
            if (pendingAction === "deposit") {
              try {
                const w = parseEther(depositEth || "0");
                if (w <= BigInt(0)) {
                  setError("Amount must be greater than zero.");
                  return;
                }
              } catch {
                setError("Invalid ETH amount.");
                return;
              }
            }

            const label = TX_STATUS_LABELS[pendingAction];

            switch (pendingAction) {
              case "deposit": {
                if (
                  depositSim.isFetching ||
                  depositSim.error != null ||
                  !depositSim.data?.request
                ) {
                  return;
                }
                lastTxLabelRef.current = label;
                setError(null);
                setStatus(`${label} pending — confirm in your wallet…`);
                writeContract(depositSim.data.request);
                break;
              }
              case "release": {
                if (
                  releaseSim.isFetching ||
                  releaseSim.error != null ||
                  !releaseSim.data?.request
                ) {
                  return;
                }
                lastTxLabelRef.current = label;
                setError(null);
                setStatus(`${label} pending — confirm in your wallet…`);
                writeContract(releaseSim.data.request);
                break;
              }
              case "dispute": {
                if (
                  disputeSim.isFetching ||
                  disputeSim.error != null ||
                  !disputeSim.data?.request
                ) {
                  return;
                }
                lastTxLabelRef.current = label;
                setError(null);
                setStatus(`${label} pending — confirm in your wallet…`);
                writeContract(disputeSim.data.request);
                break;
              }
              case "resolveSeller": {
                if (
                  resolveSellerSim.isFetching ||
                  resolveSellerSim.error != null ||
                  !resolveSellerSim.data?.request
                ) {
                  return;
                }
                lastTxLabelRef.current = label;
                setError(null);
                setStatus(`${label} pending — confirm in your wallet…`);
                writeContract(resolveSellerSim.data.request);
                break;
              }
              case "resolveBuyer": {
                if (
                  resolveBuyerSim.isFetching ||
                  resolveBuyerSim.error != null ||
                  !resolveBuyerSim.data?.request
                ) {
                  return;
                }
                lastTxLabelRef.current = label;
                setError(null);
                setStatus(`${label} pending — confirm in your wallet…`);
                writeContract(resolveBuyerSim.data.request);
                break;
              }
              default:
                break;
            }
          }}
        />
      )}
    </div>
  );
}

function buildDealSuggestions(
  stateIdx: number,
  role: "buyer" | "seller" | "arbiter" | "observer" | "disconnected"
): string[] {
  if (stateIdx === 0) {
    if (role === "buyer") {
      return [
        "How much ETH should I deposit?",
        "Can I change the seller after depositing?",
        "What happens right after I deposit?",
      ];
    }
    return [
      "Is this deal funded yet?",
      "What does the buyer need to do first?",
      "What does the arbiter do during this stage?",
    ];
  }
  if (stateIdx === 1) {
    if (role === "buyer") {
      return [
        "Should I release now or wait?",
        "When should I open a dispute instead of releasing?",
        "How does the 7-day timeout affect me?",
      ];
    }
    if (role === "seller") {
      return [
        "When can I call claimTimeout?",
        "What happens if the buyer never releases?",
        "Can I open a dispute as the seller?",
      ];
    }
    if (role === "arbiter") {
      return [
        "When can I act on this deal?",
        "Who can open a dispute here?",
        "What happens if nobody opens a dispute?",
      ];
    }
    return [
      "What state is this deal in?",
      "Who can act next on this deal?",
    ];
  }
  if (stateIdx === 4) {
    if (role === "arbiter") {
      return [
        "How do I resolve in favor of the buyer?",
        "How do I resolve in favor of the seller?",
        "What should I verify before deciding?",
      ];
    }
    return [
      "What can I do while this deal is in dispute?",
      "How does the arbiter decide?",
      "Can a dispute be cancelled?",
    ];
  }
  if (stateIdx === 2 || stateIdx === 3) {
    return [
      "Is there anything left I can do on this deal?",
      "Why is this deal finished?",
      "Where do I see this transaction on the explorer?",
    ];
  }
  return [
    "Explain this deal in simple terms.",
    "What is my role here?",
  ];
}
