"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { decodeEventLog, isAddress } from "viem";
import {
  useAccount,
  useChainId,
  useConnect,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import { injected } from "wagmi/connectors";

import ScrollExpandMedia from "@/components/ui/scroll-expansion-hero";
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

export function EscrowHome() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectAsync, isPending: isConnecting } = useConnect();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending: isDeploying } = useWriteContract();

  const [sellerInput, setSellerInput] = useState("");
  const [arbiterInput, setArbiterInput] = useState("");
  const [openInput, setOpenInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [showLoader, setShowLoader] = useState(false);

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

  useEffect(() => {
    const SESSION_KEY = "escrow_prefetch_done_v1";
    const PREFETCH_ROUTES = ["/", "/how-it-works", "/faq", "/contributors", "/explore"];

    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(SESSION_KEY) === "1") return;

    setShowLoader(true);

    for (const route of PREFETCH_ROUTES) {
      router.prefetch(route);
    }

    const closeTimer = window.setTimeout(() => {
      setShowLoader(false);
      window.sessionStorage.setItem(SESSION_KEY, "1");
    }, 1200);

    return () => window.clearTimeout(closeTimer);
  }, [router]);

  const onConnect = async () => {
    setError(null);
    try {
      await connectAsync({ connector: injected() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect wallet");
    }
  };

  const onDeploy = async () => {
    setError(null);
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

    const factoryCode = await publicClient.getBytecode({
      address: factoryAddress,
    });
    if (!factoryCode || factoryCode === "0x") {
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
    try {
      const hash = await writeContractAsync({
        address: factoryAddress,
        abi: escrowFactoryAbi,
        functionName: "createEscrow",
        args: [sellerInput as `0x${string}`, arbiterInput as `0x${string}`],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let createdAddress: string | null = null;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: escrowFactoryAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "EscrowCreated") {
            createdAddress = (decoded.args as { escrow: string }).escrow;
            break;
          }
        } catch {
          // ignore unrelated logs
        }
      }

      if (!createdAddress) {
        setError("Deploy confirmed but EscrowCreated event was not found.");
        return;
      }
      setDeployedAddress(createdAddress);
      router.push(`/escrow/${createdAddress}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deploy failed");
    }
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
                      isDeploying ||
                      !sellerInput ||
                      !arbiterInput ||
                      !!sellerError ||
                      !!arbiterError
                    }
                    className="w-full"
                  >
                    {isDeploying ? "Deploying…" : "Deploy escrow"}
                    {!isDeploying && <ArrowRight className="size-3.5" />}
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







