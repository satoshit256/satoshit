"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, baseSepolia } from "wagmi/chains";
import { http } from "viem";
import { WALLETCONNECT_PROJECT_ID, CHAIN_ID } from "./config";

const activeChain = CHAIN_ID === base.id ? base : baseSepolia;

export const wagmiConfig = getDefaultConfig({
  appName: "Satoshit",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [activeChain],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
});
