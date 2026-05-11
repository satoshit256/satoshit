"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, baseSepolia } from "wagmi/chains";
import { fallback, http } from "viem";
import { WALLETCONNECT_PROJECT_ID, CHAIN_ID } from "./config";

const activeChain = CHAIN_ID === base.id ? base : baseSepolia;

/**
 * Multi-RPC fallback transports.
 *
 * Design: viem's `fallback()` tries each http() transport in order, fails over
 * on rate limits / timeouts. This makes the site resilient even under heavy
 * traffic, because no single RPC endpoint can throttle us into a blank UI.
 * Every RPC below is public / free / no-auth.
 */
const BASE_SEPOLIA_RPCS = [
  "https://base-sepolia-rpc.publicnode.com",
  "https://sepolia.base.org",
  "https://base-sepolia.drpc.org",
  "https://base-sepolia.blockpi.network/v1/rpc/public",
  "https://endpoints.omniatech.io/v1/base/sepolia/public",
];

const BASE_MAINNET_RPCS = [
  "https://base-rpc.publicnode.com",
  "https://mainnet.base.org",
  "https://base.drpc.org",
  "https://base.blockpi.network/v1/rpc/public",
  "https://base.meowrpc.com",
];

const transportOpts = {
  timeout: 8_000,
  retryCount: 2,
  retryDelay: 400,
  batch: { batchSize: 10, wait: 10 },
};

export const wagmiConfig = getDefaultConfig({
  appName: "Satoshit",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [activeChain],
  transports: {
    [baseSepolia.id]: fallback(
      BASE_SEPOLIA_RPCS.map((url) => http(url, transportOpts)),
      { rank: false, retryCount: 1 },
    ),
    [base.id]: fallback(
      BASE_MAINNET_RPCS.map((url) => http(url, transportOpts)),
      { rank: false, retryCount: 1 },
    ),
  },
  ssr: true,
});
