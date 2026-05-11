import type { Address } from "viem";
import { base, baseSepolia } from "wagmi/chains";

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_SATOSHIT_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as Address;

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);

export const ACTIVE_CHAIN = CHAIN_ID === base.id ? base : baseSepolia;

export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "placeholder";

export const EXPLORER_BASE =
  CHAIN_ID === base.id ? "https://basescan.org" : "https://sepolia.basescan.org";
