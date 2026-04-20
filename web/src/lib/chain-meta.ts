import { hardhat, sepolia } from "wagmi/chains";

export interface ChainMeta {
  id: number;
  label: string;
  short: string;
  /** Tailwind class for the dot in the network badge. */
  dotClass: string;
}

const CHAIN_META: Record<number, ChainMeta> = {
  [sepolia.id]: {
    id: sepolia.id,
    label: "Sepolia",
    short: "Sepolia",
    dotClass: "bg-accent",
  },
  [hardhat.id]: {
    id: hardhat.id,
    label: "Hardhat (local)",
    short: "Hardhat",
    dotClass: "bg-emerald-400",
  },
};

export function chainMeta(chainId: number | undefined): ChainMeta {
  if (chainId === undefined) {
    return { id: 0, label: "Unknown network", short: "?", dotClass: "bg-muted-foreground" };
  }
  return (
    CHAIN_META[chainId] ?? {
      id: chainId,
      label: `Chain ${chainId}`,
      short: `#${chainId}`,
      dotClass: "bg-destructive",
    }
  );
}

export function truncateAddress(address: string | undefined, head = 6, tail = 4): string {
  if (!address) return "";
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
