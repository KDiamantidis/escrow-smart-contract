"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { isAddress, parseEther } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
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
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  const [depositEth, setDepositEth] = useState("0.01");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionKey | null>(null);

  const validAddress = useMemo(
    () => isAddress(contractAddress),
    [contractAddress]
  );

  const escrowAddr = validAddress ? (contractAddress as `0x${string}`) : undefined;

  const buyerQuery = useReadContract({
    address: escrowAddr,
    abi: escrowAbi,
    functionName: "buyer",
    query: { enabled: !!escrowAddr },
  });
  const sellerQuery = useReadContract({
    address: escrowAddr,
    abi: escrowAbi,
    functionName: "seller",
    query: { enabled: !!escrowAddr },
  });
  const arbiterQuery = useReadContract({
    address: escrowAddr,
    abi: escrowAbi,
    functionName: "arbiter",
    query: { enabled: !!escrowAddr },
  });
  const stateQuery = useReadContract({
    address: escrowAddr,
    abi: escrowAbi,
    functionName: "state",
    query: { enabled: !!escrowAddr },
  });

  const buyer = buyerQuery.data as string | undefined;
  const seller = sellerQuery.data as string | undefined;
  const arbiter = arbiterQuery.data as string | undefined;
  const state = stateQuery.data;

  const refetchAll = async () => {
    await Promise.all([
      buyerQuery.refetch(),
      sellerQuery.refetch(),
      arbiterQuery.refetch(),
      stateQuery.refetch(),
    ]);
  };

  const runTx = async (
    label: string,
    fn: () => Promise<`0x${string}`>
  ) => {
    if (!publicClient || !escrowAddr) return;
    setError(null);
    setStatus(`${label} pending — confirm in your wallet…`);
    try {
      const hash = await fn();
      setStatus(`${label} broadcast. Waiting for confirmation…`);
      await publicClient.waitForTransactionReceipt({ hash });
      await refetchAll();
      setStatus(`${label} confirmed.`);
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setPendingAction(null);
    }
  };

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

  const wrongChain = isConnected && chainId !== sepolia.id;

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

  const { setDealContext, setSuggestions } = useAssistantContext();

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

  const runAction = async (key: ActionKey) => {
    if (!escrowAddr) return;
    if (key === "deposit") {
      let value: bigint;
      try {
        value = parseEther(depositEth || "0");
      } catch {
        setError("Invalid ETH amount.");
        return;
      }
      if (value <= BigInt(0)) {
        setError("Amount must be greater than zero.");
        return;
      }
      await runTx("Deposit", () =>
        writeContractAsync({
          address: escrowAddr,
          abi: escrowAbi,
          functionName: "deposit",
          value,
        })
      );
      return;
    }
    if (key === "release") {
      await runTx("Release", () =>
        writeContractAsync({
          address: escrowAddr,
          abi: escrowAbi,
          functionName: "release",
        })
      );
      return;
    }
    if (key === "dispute") {
      await runTx("Open dispute", () =>
        writeContractAsync({
          address: escrowAddr,
          abi: escrowAbi,
          functionName: "initiateDispute",
        })
      );
      return;
    }
    if (key === "resolveSeller") {
      await runTx("Resolve to seller", () =>
        writeContractAsync({
          address: escrowAddr,
          abi: escrowAbi,
          functionName: "resolveDispute",
          args: [false],
        })
      );
      return;
    }
    if (key === "resolveBuyer") {
      await runTx("Resolve to buyer", () =>
        writeContractAsync({
          address: escrowAddr,
          abi: escrowAbi,
          functionName: "resolveDispute",
          args: [true],
        })
      );
    }
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
            {stateQuery.isLoading ? (
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
              loading={buyerQuery.isLoading}
            />
            <AddressRow
              label="Seller"
              value={seller}
              loading={sellerQuery.isLoading}
            />
            <AddressRow
              label="Arbiter"
              value={arbiter}
              loading={arbiterQuery.isLoading}
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
              {stateQuery.isLoading && (
                <div className="space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-1/2" />
                </div>
              )}

              {!stateQuery.isLoading && stateIdx === 0 && (
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
                    disabled={isWriting}
                    className="font-mono"
                  />
                  <Button
                    disabled={!isBuyer || isWriting || !depositEth}
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

              {!stateQuery.isLoading && stateIdx === 1 && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    disabled={!isBuyer || isWriting}
                    onClick={() => setPendingAction("release")}
                  >
                    Release to seller
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!isBuyer || isWriting}
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

              {!stateQuery.isLoading && stateIdx === 4 && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    disabled={!isArbiter || isWriting}
                    onClick={() => setPendingAction("resolveSeller")}
                  >
                    Resolve to seller
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!isArbiter || isWriting}
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

              {!stateQuery.isLoading && (stateIdx === 2 || stateIdx === 3) && (
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
            if (!open && !isWriting) setPendingAction(null);
          }}
          title={dialogConfig.title}
          description={dialogConfig.description}
          confirmLabel={dialogConfig.confirmLabel}
          confirmVariant={dialogConfig.confirmVariant}
          busy={isWriting}
          onConfirm={() => {
            if (pendingAction) void runAction(pendingAction);
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
