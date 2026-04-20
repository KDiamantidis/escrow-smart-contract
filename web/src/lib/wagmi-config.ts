import { http, createConfig } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const sepoliaRpc =
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://ethereum-sepolia-rpc.publicnode.com";

export const SUPPORTED_CHAIN_IDS: number[] = [sepolia.id, hardhat.id];

export const wagmiConfig = createConfig({
  chains: [sepolia, hardhat],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(sepoliaRpc),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
});
