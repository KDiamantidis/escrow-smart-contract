import type { Metadata } from "next";

import { WalletStatusBar } from "@/components/wallet-status-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Terms of Service - Ethereum Escrow",
  description:
    "Terms of service, risk disclaimers, and limitations for the Ethereum Escrow dApp.",
};

const LAST_UPDATED = "April 23, 2026";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <WalletStatusBar />
      <main className="container mx-auto max-w-4xl space-y-8 px-4 py-10">
        <header className="space-y-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            These terms describe how you may use this decentralized application, important risks
            of on-chain escrow, and the limits of what this site provides. This is not legal
            advice; have qualified counsel review before mainnet or commercial use.
          </p>
        </header>

        <Separator />

        <section className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>1. The service</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              Ethereum Escrow is a frontend that helps you interact with smart contracts you deploy
              or open on public networks. We do not custody assets, operate as a money transmitter,
              or guarantee transaction outcomes.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Blockchain and smart-contract risks</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              On-chain transactions are irreversible. Bugs, user error, network congestion, oracle
              or RPC issues, wallet compromise, and malicious counterparties can lead to loss of
              funds. You are solely responsible for verifying addresses, networks, and contract
              logic before sending value.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. AI assistant</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              The assistant provides general information about the dApp. It may be wrong,
              incomplete, or unavailable. Do not rely on it for legal, financial, or security
              decisions. Never share private keys or seed phrases in chat.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>4. No warranties</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              The app and related materials are provided &quot;as is&quot; without warranties of
              any kind. To the fullest extent permitted by law, operators and contributors disclaim
              liability for damages arising from your use of the software or on-chain activity.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>5. Changes</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              These terms may be updated. The date above reflects the latest revision. Continued use
              after changes constitutes acceptance of the updated terms.
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
