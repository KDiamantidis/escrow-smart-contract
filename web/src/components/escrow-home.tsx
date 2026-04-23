"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { BaseError, decodeErrorResult, decodeEventLog, isAddress } from "viem";
import {
  useAccount,
  useChainId,
  useConnect,
  usePublicClient,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { injected } from "wagmi/connectors";

import ScrollExpandMedia from "@/components/ui/scroll-expansion-hero";
import { captureClientException } from "@/lib/sentry/capture-client";
import { WalletStatusBar } from "@/components/wallet-status-bar";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { escrowFactoryAbi } from "@/lib/escrow-artifact";
import { SUPPORTED_CHAIN_IDS } from "@/lib/wagmi-config";
import { LoadingScreen } from "@/components/ui/loading-screen";

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

function humanizeWriteError(err: unknown): string {
  const data = extractRevertData(err);
  if (data) {
    try {
      const decoded = decodeErrorResult({ abi: escrowFactoryAbi, data });
      return decoded.errorName;
    } catch {
      // fall through
    }
  }
  if (err instanceof BaseError) {
    const m = err.shortMessage ?? err.message;
    return /^0x[0-9a-fA-F]+$/.test(m.trim()) ? "Deploy failed." : m;
  }
  if (err instanceof Error) {
    const m = err.message;
    return /^0x[0-9a-fA-F]+$/.test(m.trim()) ? "Deploy failed." : m;
  }
  return "Deploy failed.";
}

export function EscrowHome() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectAsync, isPending: isConnecting } = useConnect();
  const publicClient = usePublicClient();
  const {
    writeContract,
    data: deployTxHash,
    isPending: isDeployPending,
    error: writeError,
    reset: resetDeployWrite,
  } = useWriteContract();

  const [sellerInput, setSellerInput] = useState("");
  const [arbiterInput, setArbiterInput] = useState("");
  const [openInput, setOpenInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [showLoader, setShowLoader] = useState(false);
  const [factoryReady, setFactoryReady] = useState<boolean>(false);

  const factoryAddress = process.env.NEXT_PUBLIC_FACTORY_ADDRESS as
    | `0x${string}`
    | undefined;

  const sellerError = useMemo(() => {
    if (!sellerInput) return null;
    if (!isAddress(sellerInput)) return "Not a valid address.";
    if (address && sellerInput.toLowerCase() === address.toLowerCase())
      return "Seller must differ from your buyer wallet.";
    return null;
  }, [sellerInput, address]);

  const arbiterError = useMemo(() => {
    if (!arbiterInput) return null;
    if (!isAddress(arbiterInput)) return "Not a valid address.";
    if (address && arbiterInput.toLowerCase() === address.toLowerCase())
      return "Arbiter must differ from your buyer wallet.";
    if (
      sellerInput &&
      arbiterInput.toLowerCase() === sellerInput.toLowerCase()
    )
      return "Arbiter must differ from the seller.";
    return null;
  }, [arbiterInput, sellerInput, address]);

  const openError = useMemo(() => {
    if (!openInput) return null;
    return isAddress(openInput) ? null : "Not a valid contract address.";
  }, [openInput]);

  const canUseFactory = useMemo(
    () =>
      !!factoryAddress &&
      isAddress(factoryAddress) &&
      !!address &&
      isAddress(address) &&
      SUPPORTED_CHAIN_IDS.includes(chainId) &&
      !sellerError &&
      !arbiterError &&
      isAddress(sellerInput) &&
      isAddress(arbiterInput) &&
      factoryReady,
    [
      factoryAddress,
      address,
      chainId,
      sellerError,
      arbiterError,
      sellerInput,
      arbiterInput,
      factoryReady,
    ]
  );

  const createEscrowSim = useSimulateContract({
    address:
      factoryAddress && isAddress(factoryAddress)
        ? factoryAddress
        : "0x0000000000000000000000000000000000000000",
    abi: escrowFactoryAbi,
    functionName: "createEscrow",
    args: [
      isAddress(sellerInput)
        ? (sellerInput as `0x${string}`)
        : "0x0000000000000000000000000000000000000000",
      isAddress(arbiterInput)
        ? (arbiterInput as `0x${string}`)
        : "0x0000000000000000000000000000000000000000",
    ],
    query: { enabled: canUseFactory },
  });

  const {
    data: deployReceipt,
    isLoading: isDeployConfirming,
    isSuccess: isDeployConfirmed,
  } = useWaitForTransactionReceipt({
    hash: deployTxHash,
  });
  const isDeploying = isDeployPending || isDeployConfirming;

  useEffect(() => {
    const SESSION_KEY = "escrow_prefetch_done_v1";
    const PREFETCH_ROUTES = [
      "/",
      "/how-it-works",
      "/faq",
      "/contributors",
      "/explore",
      "/privacy",
      "/terms",
    ];

    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(SESSION_KEY) === "1") return;

    queueMicrotask(() => setShowLoader(true));

    for (const route of PREFETCH_ROUTES) {
      router.prefetch(route);
    }

    const closeTimer = window.setTimeout(() => {
      setShowLoader(false);
      window.sessionStorage.setItem(SESSION_KEY, "1");
    }, 1200);

    return () => window.clearTimeout(closeTimer);
  }, [router]);

  useEffect(() => {
    if (!publicClient || !factoryAddress || !isAddress(factoryAddress)) {
      queueMicrotask(() => setFactoryReady(false));
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const factoryCode = await publicClient.getBytecode({
          address: factoryAddress,
        });
        if (!cancelled) setFactoryReady(!!factoryCode && factoryCode !== "0x");
      } catch {
        if (!cancelled) setFactoryReady(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publicClient, factoryAddress, chainId]);

  useEffect(() => {
    if (!writeError) return;
    captureClientException(writeError, { flow: "deploy_escrow_write", chainId });
    queueMicrotask(() => setError(humanizeWriteError(writeError)));
  }, [writeError, chainId]);

  useEffect(() => {
    const err = createEscrowSim.error;
    if (!err) return;
    captureClientException(err, { flow: "deploy_escrow_simulate", chainId });
    queueMicrotask(() => setError(humanizeWriteError(err)));
  }, [createEscrowSim.error, chainId]);

  useEffect(() => {
    if (!isDeployConfirmed || !deployReceipt) return;

    let createdAddress: string | null = null;
    for (const log of deployReceipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: escrowFactoryAbi,
          eventName: "EscrowCreated",
          data: log.data,
          topics: log.topics,
        });
        const escrow = decoded.args.escrow;
        if (escrow && isAddress(escrow)) {
          createdAddress = escrow;
          break;
        }
      } catch {
        // ignore unrelated logs
      }
    }

    if (!createdAddress) {
      queueMicrotask(() =>
        setError("Deploy confirmed but EscrowCreated event was not found.")
      );
      return;
    }

    queueMicrotask(() => setDeployedAddress(createdAddress));
    router.push(`/escrow/${createdAddress}`);
  }, [isDeployConfirmed, deployReceipt, router]);

  const onConnect = async () => {
    setError(null);
    try {
      await connectAsync({ connector: injected() });
    } catch (e) {
      captureClientException(e, { flow: "wallet_connect", chainId });
      setError(e instanceof Error ? e.message : "Could not connect wallet");
    }
  };

  const onDeploy = async () => {
    setError(null);
    resetDeployWrite();
    if (!publicClient) {
      setError("No RPC client. Set NEXT_PUBLIC_RPC_URL in .env.local.");
      return;
    }
    if (!address || !isAddress(address)) {
      setError("Connect a valid wallet address first.");
      return;
    }
    if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
      setError("Switch your wallet to a supported chain (Sepolia / Hardhat).");
      return;
    }
    if (!factoryAddress || !isAddress(factoryAddress)) {
      setError("Set NEXT_PUBLIC_FACTORY_ADDRESS in web/.env.local.");
      return;
    }
    if (!factoryReady) {
      setError(
        `NEXT_PUBLIC_FACTORY_ADDRESS (${factoryAddress}) is not a deployed contract on this chain.`
      );
      return;
    }

    if (sellerError || arbiterError) {
      setError(sellerError ?? arbiterError);
      return;
    }
    if (!isAddress(sellerInput) || !isAddress(arbiterInput)) {
      setError("Enter valid seller and arbiter addresses.");
      return;
    }
    if (createEscrowSim.error) {
      setError(humanizeWriteError(createEscrowSim.error));
      return;
    }
    if (!createEscrowSim.data?.request) {
      setError("Deploy request is not ready yet. Try again in a moment.");
      return;
    }
    writeContract(createEscrowSim.data.request);
  };

  const onOpenExisting = () => {
    if (!openInput || openError) return;
    router.push(`/escrow/${openInput}`);
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <LoadingScreen visible={showLoader} />
      <WalletStatusBar overlay />

      <ScrollExpandMedia
        mediaType="model"
        mediaSrc="/models/ethereum-logo-3d.glb"
        title="Smart Contract"
        date="Ethereum"
        modelRotationSpeed={0.8}
        modelScale={0.96}
      >
        <div className="mx-auto max-w-3xl space-y-10 text-pretty pt-2">
          <header className="space-y-3">
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              How this escrow works
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              The <strong className="text-foreground">buyer</strong> deploys a
              new contract per deal and assigns a{" "}
              <strong className="text-foreground">seller</strong> and an{" "}
              <strong className="text-foreground">arbiter</strong>. The buyer
              deposits ETH, then chooses to{" "}
              <strong className="text-foreground">release</strong> funds to the
              seller. If something goes wrong, the buyer can{" "}
              <strong className="text-foreground">open a dispute</strong> and
              the arbiter resolves it in favor of either party.
            </p>
          </header>

          <Separator />

          <section className="grid gap-6 md:grid-cols-2" aria-label="Get started">
            <Card>
              <CardHeader>
                <CardTitle>Deploy a new escrow</CardTitle>
                <CardDescription>
                  Your wallet becomes the buyer. The seller and arbiter
                  addresses are immutable once deployed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="seller" className="text-sm font-medium">
                    Seller address
                  </label>
                  <Input
                    id="seller"
                    placeholder="0x…"
                    value={sellerInput}
                    onChange={(e) => setSellerInput(e.target.value.trim())}
                    disabled={!isConnected || isDeploying}
                    aria-invalid={!!sellerError}
                    aria-describedby={sellerError ? "seller-error" : undefined}
                    className="font-mono"
                  />
                  {sellerError && (
                    <p
                      id="seller-error"
                      className="text-xs text-destructive"
                      role="alert"
                    >
                      {sellerError}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="arbiter" className="text-sm font-medium">
                    Arbiter address
                  </label>
                  <Input
                    id="arbiter"
                    placeholder="0x…"
                    value={arbiterInput}
                    onChange={(e) => setArbiterInput(e.target.value.trim())}
                    disabled={!isConnected || isDeploying}
                    aria-invalid={!!arbiterError}
                    aria-describedby={arbiterError ? "arbiter-error" : undefined}
                    className="font-mono"
                  />
                  {arbiterError && (
                    <p
                      id="arbiter-error"
                      className="text-xs text-destructive"
                      role="alert"
                    >
                      {arbiterError}
                    </p>
                  )}
                </div>

                {!isConnected ? (
                  <Button
                    onClick={onConnect}
                    disabled={isConnecting}
                    className="w-full"
                  >
                    {isConnecting ? "Connecting…" : "Connect wallet to deploy"}
                  </Button>
                ) : (
                  <Button
                    onClick={onDeploy}
                    disabled={
                      !createEscrowSim.data ||
                      isDeployPending ||
                      isDeployConfirming ||
                      !sellerInput ||
                      !arbiterInput ||
                      !!sellerError ||
                      !!arbiterError
                    }
                    className="w-full"
                  >
                    {isDeployPending
                      ? "Check wallet…"
                      : isDeployConfirming
                        ? "Deploying…"
                        : isDeployConfirmed
                          ? "Redirecting…"
                          : "Deploy Escrow"}
                    {!isDeployPending && !isDeployConfirming && !isDeployConfirmed && (
                      <ArrowRight className="size-3.5" />
                    )}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  After deployment you are redirected to the deal page where
                  you can deposit, release, or open a dispute.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Open an existing deal</CardTitle>
                <CardDescription>
                  Already have a contract address? Jump straight to its page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="openAddr" className="text-sm font-medium">
                    Contract address
                  </label>
                  <Input
                    id="openAddr"
                    placeholder="0x…"
                    value={openInput}
                    onChange={(e) => setOpenInput(e.target.value.trim())}
                    aria-invalid={!!openError}
                    aria-describedby={openError ? "open-error" : undefined}
                    className="font-mono"
                  />
                  {openError && (
                    <p
                      id="open-error"
                      className="text-xs text-destructive"
                      role="alert"
                    >
                      {openError}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={onOpenExisting}
                  disabled={!openInput || !!openError}
                  className="w-full"
                >
                  Open deal
                  <ExternalLink className="size-3.5" />
                </Button>
                <p className="text-xs text-muted-foreground">
                  The contract is read straight from the chain; no off-chain
                  state is stored by this app.
                </p>
              </CardContent>
            </Card>
          </section>

          {deployedAddress && (
            <Alert>
              <AlertTitle>Deploy successful</AlertTitle>
              <AlertDescription className="font-mono break-all">
                {deployedAddress}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert
              variant="destructive"
              role="status"
              aria-live="polite"
            >
              <AlertTitle>Could not deploy</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </ScrollExpandMedia>
    </div>
  );
}







