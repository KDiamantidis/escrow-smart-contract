import type { Metadata } from "next";
import Link from "next/link";

import { WalletStatusBar } from "@/components/wallet-status-bar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "FAQ — Ethereum Escrow",
  description:
    "Common questions about deploying, funding, releasing, and disputing escrow contracts on Sepolia.",
};

const FAQ = [
  {
    q: "What network does this app use?",
    a: "By default, deployments target the Sepolia testnet so you can experiment with real wallet flows without spending mainnet ETH. The app also supports a local Hardhat network for development.",
  },
  {
    q: "Who can deploy a contract?",
    a: "Anyone with a connected wallet. The deploying account becomes the buyer and chooses the seller and arbiter addresses up-front.",
  },
  {
    q: "Can the buyer change the seller or arbiter later?",
    a: "No. Both addresses are immutable after deployment, which is exactly what makes the escrow trustworthy. If you typed something wrong, deploy a new deal.",
  },
  {
    q: "What does the arbiter actually do?",
    a: "Nothing during a normal flow. They only act when a dispute is opened, and their single power is to decide whether the locked funds go to the buyer or to the seller.",
  },
  {
    q: "What happens if the arbiter never responds?",
    a: "The funds stay locked in the contract. Pick an arbiter that both parties trust and can reach off-chain.",
  },
  {
    q: "Are there any fees beyond gas?",
    a: "No. The contract takes no cut. You pay only Sepolia gas for deployment and for each transition (deposit, release, dispute, resolve).",
  },
  {
    q: "I sent ETH directly to the contract. Now what?",
    a: "Use the deposit action from the deal page. Direct transfers outside the documented flow may not be tracked correctly by the UI.",
  },
  {
    q: "Where can I see the source code?",
    a: "The Solidity contract lives in the repository under contracts/Escrow.sol. The frontend is the Next.js app you are using right now.",
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <WalletStatusBar />
      <main className="container mx-auto max-w-3xl space-y-10 px-4 py-10">
        <header className="space-y-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            FAQ
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Frequently asked questions
          </h1>
          <p className="text-base text-muted-foreground">
            Short answers to the things people ask before opening their first
            deal.
          </p>
        </header>

        <section className="space-y-3">
          {FAQ.map((item) => (
            <Card key={item.q}>
              <CardHeader>
                <CardTitle>{item.q}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {item.a}
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="flex flex-wrap items-center gap-3">
          <Button render={<Link href="/how-it-works" />}>
            Read the walkthrough
          </Button>
          <Button variant="outline" render={<Link href="/" />}>
            Back to home
          </Button>
        </section>
      </main>
    </div>
  );
}
