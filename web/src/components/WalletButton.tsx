"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { ACTIVE_CHAIN } from "@/lib/config";

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
        const ready = mounted;
        return (
          <div style={{ opacity: ready ? 1 : 0 }}>
            {!account ? (
              <button
                onClick={openConnectModal}
                className="px-3 py-1 border border-phosphor text-phosphor hover:bg-phosphor hover:text-black text-xs tracking-widest"
              >
                [ connect wallet ]
              </button>
            ) : chain?.unsupported || chain?.id !== ACTIVE_CHAIN.id ? (
              <SwitchChainButton />
            ) : (
              <button
                onClick={openAccountModal}
                className="px-3 py-1 border border-phosphor-dim text-phosphor-dim hover:text-phosphor text-xs"
              >
                {account.displayName}
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

function SwitchChainButton() {
  const { switchChain, isPending } = useSwitchChain();
  return (
    <button
      onClick={() => switchChain({ chainId: ACTIVE_CHAIN.id })}
      className="px-3 py-1 border border-amber text-amber hover:bg-amber hover:text-black text-xs tracking-widest"
    >
      {isPending ? "switching…" : `[ switch to ${ACTIVE_CHAIN.name} ]`}
    </button>
  );
}
