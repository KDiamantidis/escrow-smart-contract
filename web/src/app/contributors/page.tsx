import type { Metadata } from "next";
import Link from "next/link";

import { ContributorsTeamShowcase } from "@/components/contributors-team-showcase";
import { WalletStatusBar } from "@/components/wallet-status-bar";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Contributors — Ethereum Escrow",
  description:
    "The people building the Ethereum Escrow dApp and the smart contract behind it.",
};

export default function ContributorsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <WalletStatusBar />
      <main className="container mx-auto max-w-6xl space-y-12 px-4 py-10">
        <header className="space-y-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Contributors
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            The people behind the project
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Ethereum Escrow is an open project. Hover over a card or a name to
            highlight a contributor, then click through to their GitHub.
          </p>
        </header>

        <ContributorsTeamShowcase />

        <section className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-8">
          <Button render={<Link href="/explore" />}>Explore the network</Button>
          <Button variant="outline" render={<Link href="/" />}>
            Back to home
          </Button>
        </section>
      </main>
    </div>
  );
}

