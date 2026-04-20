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
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "How it Works — Ethereum Escrow",
  description:
    "Learn how the on-chain escrow flow works between buyer, seller, and arbiter on Sepolia.",
};

const STEPS = [
  {
    title: "1. Deploy a deal",
    body: "The buyer deploys a new escrow contract from the home page, naming the seller and an arbiter that both sides trust to mediate disputes.",
  },
  {
    title: "2. Fund the escrow",
    body: "The buyer sends ETH to the contract. The agreed amount is locked on-chain — neither side can move it unilaterally.",
  },
  {
    title: "3. Release or dispute",
    body: "When the buyer is happy, they release the funds to the seller. If something goes wrong, either party opens a dispute and the arbiter decides who receives the balance.",
  },
  {
    title: "4. Settle on-chain",
    body: "Every transition is a transparent transaction on Sepolia. There is no custodian and no hidden fee — only gas for the network.",
  },
];

const ROLES = [
  {
    title: "Buyer",
    body: "Deploys the contract, deposits ETH, and either releases the funds or initiates a dispute.",
  },
  {
    title: "Seller",
    body: "Receives the funds once the buyer releases them, or once the arbiter resolves a dispute in the seller's favour.",
  },
  {
    title: "Arbiter",
    body: "A neutral third party agreed up-front. Acts only if a dispute is opened and decides which side receives the balance.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <WalletStatusBar />
      <main className="container mx-auto max-w-3xl space-y-10 px-4 py-10">
        <header className="space-y-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            How it works
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            A simple, on-chain escrow flow
          </h1>
          <p className="text-base text-muted-foreground">
            Three parties, one smart contract, no custodian. Funds move only
            when the rules in the contract say so.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="font-heading text-lg font-medium tracking-tight">
            The four steps
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {STEPS.map((step) => (
              <Card key={step.title}>
                <CardHeader>
                  <CardTitle>{step.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {step.body}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h2 className="font-heading text-lg font-medium tracking-tight">
            The three roles
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {ROLES.map((role) => (
              <Card key={role.title}>
                <CardHeader>
                  <CardTitle>{role.title}</CardTitle>
                  <CardDescription>{role.body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-3">
          <Button render={<Link href="/" />}>Start a new deal</Button>
          <Button variant="outline" render={<Link href="/faq" />}>
            Read the FAQ
          </Button>
        </section>
      </main>
    </div>
  );
}
