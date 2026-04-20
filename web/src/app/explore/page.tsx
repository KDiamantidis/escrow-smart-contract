import type { Metadata } from "next";
import Link from "next/link";

import { WalletStatusBar } from "@/components/wallet-status-bar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Explore — Ethereum Escrow",
  description:
    "Browse Sepolia, inspect deployed escrow contracts, and jump back into your own deals.",
};

function explorerBase(): string {
  return (
    process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://sepolia.etherscan.io"
  ).replace(/\/$/, "");
}

export default function ExplorePage() {
  const explorer = explorerBase();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WalletStatusBar />
      <main className="container mx-auto max-w-3xl space-y-10 px-4 py-10">
        <header className="space-y-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Explore
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Explore deals on the network
          </h1>
          <p className="text-base text-muted-foreground">
            Every escrow contract lives on Sepolia. You can deploy a new one
            from the home page, open one you already know about, or browse the
            block explorer to see what is happening on-chain.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Open an existing deal</CardTitle>
              <CardDescription>
                If someone shared a contract address with you, jump straight to
                the deal page from the home screen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" render={<Link href="/" />}>
                Go to the address opener
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Start a new deal</CardTitle>
              <CardDescription>
                Pick the seller and arbiter, deploy the contract, and fund the
                escrow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button render={<Link href="/" />}>Deploy a new escrow</Button>
            </CardContent>
          </Card>

          <Card className="sm:col-span-2">
            <CardHeader>
              <CardTitle>Block explorer</CardTitle>
              <CardDescription>
                Inspect transactions, addresses, and contract events on Sepolia.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                The frontend uses
                {" "}
                <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {explorer}
                </code>
                {" "}
                as the default explorer. Override it with{" "}
                <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
                  NEXT_PUBLIC_EXPLORER_URL
                </code>
                .
              </p>
              <a
                href={explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                Open the explorer
              </a>
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-wrap items-center gap-3">
          <Button variant="outline" render={<Link href="/how-it-works" />}>
            How it works
          </Button>
          <Button variant="outline" render={<Link href="/faq" />}>
            FAQ
          </Button>
        </section>
      </main>
    </div>
  );
}
