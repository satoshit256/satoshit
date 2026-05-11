"use client";

import { useBlockNumber, useReadContract, useReadContracts, useAccount } from "wagmi";
import { SATOSHIT_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { formatEther, formatUnits } from "viem";
import { formatDifficulty } from "@/lib/pow";

function fmt(n?: bigint, decimals = 18, digits = 4): string {
  if (n === undefined) return "…";
  const s = formatUnits(n, decimals);
  const [int, dec = ""] = s.split(".");
  return digits === 0 ? int : `${int}.${dec.slice(0, digits).padEnd(digits, "0")}`;
}

export function MiningDashboard() {
  const { address } = useAccount();
  const { data: block } = useBlockNumber({ watch: true });

  const contract = { address: CONTRACT_ADDRESS, abi: SATOSHIT_ABI } as const;
  const { data } = useReadContracts({
    allowFailure: true,
    query: { refetchInterval: 10_000 },
    contracts: [
      { ...contract, functionName: "currentEra" },
      { ...contract, functionName: "currentReward" },
      { ...contract, functionName: "currentDifficulty" },
      { ...contract, functionName: "currentEpoch" },
      { ...contract, functionName: "totalMints" },
      { ...contract, functionName: "minedSupply" },
      { ...contract, functionName: "remainingSupply" },
      { ...contract, functionName: "MAX_SUPPLY" },
      { ...contract, functionName: "mintsUntilRetarget" },
      { ...contract, functionName: "blocksUntilNextEpoch" },
    ],
  });

  const userBal = useReadContract({
    ...contract,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const [era, reward, diff, epoch, mints, mined, remaining, max, toRetarget, toEpoch] =
    (data ?? []).map((r) => (r.status === "success" ? (r.result as bigint) : undefined));

  const progressPct =
    mined !== undefined && max !== undefined && max !== 0n
      ? Number((mined * 10000n) / max) / 100
      : 0;

  const rows: [string, string][] = [
    ["era", era !== undefined ? era.toString() : "…"],
    ["reward/mint", `${fmt(reward)} SHIT`],
    ["difficulty", diff !== undefined ? formatDifficulty(diff) : "…"],
    ["epoch", epoch !== undefined ? epoch.toString() : "…"],
    ["next retarget (mints)", toRetarget !== undefined ? toRetarget.toString() : "…"],
    ["next epoch (blocks)", toEpoch !== undefined ? toEpoch.toString() : "…"],
    ["total mints", mints !== undefined ? mints.toString() : "…"],
    ["minted supply", `${fmt(mined)} / ${fmt(max)} SHIT`],
    ["remaining", `${fmt(remaining)} SHIT`],
    ["your balance", address ? `${fmt(userBal.data as bigint | undefined)} SHIT` : "connect wallet"],
    ["block", block !== undefined ? block.toString() : "…"],
  ];

  return (
    <div className="ascii-box p-4 text-sm" data-label="[ dashboard ]">
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
        {rows.map(([k, v]) => (
          <li key={k} className="flex justify-between border-b border-phosphor-faint/40 py-1">
            <span className="text-muted">{k}</span>
            <span className="text-phosphor term-glow">{v}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>total mining progress</span>
          <span>{progressPct.toFixed(4)}%</span>
        </div>
        <div className="h-2 bg-phosphor-faint/40 overflow-hidden">
          <div
            className="h-full bg-phosphor shadow-glow"
            style={{ width: `${Math.min(progressPct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
