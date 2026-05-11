"use client";

import { useReadContracts } from "wagmi";
import { SATOSHIT_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { formatUnits } from "viem";
import { formatDifficulty } from "@/lib/pow";

function fmt(n?: bigint, d = 18, dec = 4): string {
  if (n === undefined) return "…";
  const s = formatUnits(n, d);
  const [i, p = ""] = s.split(".");
  return `${i}.${p.slice(0, dec).padEnd(dec, "0")}`;
}

export default function StatsPage() {
  const contract = { address: CONTRACT_ADDRESS, abi: SATOSHIT_ABI } as const;
  const { data } = useReadContracts({
    allowFailure: true,
    query: { refetchInterval: 15_000 },
    contracts: [
      { ...contract, functionName: "totalMints" },
      { ...contract, functionName: "totalBurned" },
      { ...contract, functionName: "totalSupply" },
      { ...contract, functionName: "currentEra" },
      { ...contract, functionName: "grossReward" },
      { ...contract, functionName: "currentReward" },
      { ...contract, functionName: "currentDifficulty" },
      { ...contract, functionName: "currentEpoch" },
      { ...contract, functionName: "minedSupply" },
      { ...contract, functionName: "remainingSupply" },
      { ...contract, functionName: "MAX_SUPPLY" },
      { ...contract, functionName: "BASE_REWARD" },
      { ...contract, functionName: "BURN_BPS" },
      { ...contract, functionName: "ERA_MINTS" },
      { ...contract, functionName: "ADJUSTMENT_INTERVAL" },
      { ...contract, functionName: "EPOCH_BLOCKS" },
      { ...contract, functionName: "MAX_MINTS_PER_BLOCK" },
      { ...contract, functionName: "MAX_ERA" },
      { ...contract, functionName: "GENESIS_BLOCK" },
      { ...contract, functionName: "mintsUntilRetarget" },
      { ...contract, functionName: "blocksUntilNextEpoch" },
    ],
  });

  const r = (data ?? []).map((x) =>
    x.status === "success" ? (x.result as bigint) : undefined,
  );
  const [
    totalMints, totalBurned, totalSupply,
    era, gross, net, diff, epoch,
    mined, remaining, max,
    baseReward, burnBps, eraMints, adj, epochBlocks, maxPerBlock, maxEra, genesis,
    untilRetarget, untilEpoch,
  ] = r;

  const progress =
    mined !== undefined && max !== undefined && max !== 0n
      ? Number((mined * 10000n) / max) / 100
      : 0;

  const burnProgress =
    totalBurned !== undefined && max !== undefined && max !== 0n
      ? Number((totalBurned * 100000n) / max) / 1000
      : 0;

  const rows: [string, string][] = [
    ["total mints", totalMints?.toString() ?? "…"],
    ["era", era?.toString() ?? "…"],
    ["gross reward/mint", `${fmt(gross)} SHIT`],
    ["net reward/mint", `${fmt(net)} SHIT`],
    ["burn rate", burnBps !== undefined ? `${Number(burnBps) / 100}%` : "…"],
    ["difficulty", diff !== undefined ? formatDifficulty(diff) : "…"],
    ["epoch", epoch?.toString() ?? "…"],
    ["minted so far", `${fmt(mined)} SHIT`],
    ["burned 🔥", `${fmt(totalBurned)} SHIT`],
    ["live total supply", `${fmt(totalSupply)} SHIT`],
    ["remaining to mine", `${fmt(remaining)} SHIT`],
    ["hard cap", `${fmt(max)} SHIT`],
    ["mints until retarget", untilRetarget?.toString() ?? "…"],
    ["blocks until next epoch", untilEpoch?.toString() ?? "…"],
    ["", ""],
    ["BASE_REWARD", `${fmt(baseReward)} SHIT`],
    ["ERA_MINTS", eraMints?.toString() ?? "…"],
    ["ADJUSTMENT_INTERVAL", adj?.toString() ?? "…"],
    ["EPOCH_BLOCKS", epochBlocks?.toString() ?? "…"],
    ["MAX_MINTS_PER_BLOCK", maxPerBlock?.toString() ?? "…"],
    ["MAX_ERA (halving cutoff)", maxEra?.toString() ?? "…"],
    ["GENESIS_BLOCK", genesis?.toString() ?? "…"],
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl term-glow uppercase tracking-widest">┌ stats</h1>
        <p className="text-sm text-muted">All on-chain constants and live state.</p>
      </header>

      <div className="ascii-box p-4 text-sm" data-label="[ supply progress ]">
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>mined / max</span>
          <span>{progress.toFixed(4)}%</span>
        </div>
        <div className="h-3 bg-phosphor-faint/40 overflow-hidden mb-3">
          <div
            className="h-full bg-phosphor shadow-glow"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>burned / max</span>
          <span>{burnProgress.toFixed(4)}% 🔥</span>
        </div>
        <div className="h-3 bg-phosphor-faint/40 overflow-hidden">
          <div
            className="h-full bg-amber shadow-glow"
            style={{ width: `${Math.min(burnProgress, 100)}%` }}
          />
        </div>
      </div>

      <div className="ascii-box p-4 text-sm" data-label="[ contract state ]">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {rows.map(([k, v], i) => (
            <li
              key={i}
              className={`flex justify-between border-b border-phosphor-faint/40 py-1 ${
                k === "" ? "border-0 h-4" : ""
              }`}
            >
              <span className="text-muted">{k}</span>
              <span className="text-phosphor term-glow">{v}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
