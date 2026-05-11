"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { CONTRACT_ADDRESS, EXPLORER_BASE } from "@/lib/config";
import { formatUnits, parseAbiItem, type Log } from "viem";

type MineEvent = {
  miner: `0x${string}`;
  nonce: bigint;
  reward: bigint;
  burned: bigint;
  era: bigint;
  epoch: bigint;
  block: bigint;
  txHash: `0x${string}`;
};

export default function PoolPage() {
  const { address } = useAccount();
  const client = usePublicClient();
  const [events, setEvents] = useState<MineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!client) return;
      setLoading(true);
      setError(null);
      try {
        const latest = await client.getBlockNumber();
        const from = latest > 5000n ? latest - 5000n : 0n;
        const logs = await client.getLogs({
          address: CONTRACT_ADDRESS,
          event: parseAbiItem(
            "event Mined(address indexed miner, uint256 nonce, uint256 rewardPaid, uint256 burned, uint256 era, uint256 epoch)",
          ),
          fromBlock: from,
          toBlock: "latest",
        });
        if (cancelled) return;
        const parsed: MineEvent[] = logs.map((l: Log) => {
          const a = (l as any).args;
          return {
            miner: a.miner,
            nonce: a.nonce,
            reward: a.rewardPaid,
            burned: a.burned,
            era: a.era,
            epoch: a.epoch,
            block: l.blockNumber ?? 0n,
            txHash: l.transactionHash!,
          };
        });
        parsed.reverse();
        setEvents(parsed);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [client]);

  const mine = address?.toLowerCase();
  const totalReward = events.reduce((a, e) => a + e.reward, 0n);
  const totalBurned = events.reduce((a, e) => a + e.burned, 0n);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl term-glow uppercase tracking-widest">┌ pool</h1>
        <p className="text-sm text-muted">
          Recent Mined events across all miners (last ~5000 blocks). Self-rows highlighted.
        </p>
      </header>

      <div className="ascii-box p-4 text-xs" data-label="[ recent window ]">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-muted">events</div>
            <div className="text-phosphor term-glow text-lg">{events.length}</div>
          </div>
          <div>
            <div className="text-muted">total paid</div>
            <div className="text-phosphor term-glow text-lg">{formatUnits(totalReward, 18)} SHIT</div>
          </div>
          <div>
            <div className="text-muted">total burned 🔥</div>
            <div className="text-amber term-glow text-lg">{formatUnits(totalBurned, 18)} SHIT</div>
          </div>
        </div>
      </div>

      <div className="ascii-box p-4" data-label="[ recent mines ]">
        {loading && events.length === 0 && <p className="text-muted text-sm">loading…</p>}
        {error && <p className="text-amber text-sm">Error: {error}</p>}
        {!loading && events.length === 0 && !error && (
          <p className="text-muted text-sm">No mines in the recent window.</p>
        )}
        <ul className="space-y-1 text-xs">
          {events.map((e) => {
            const isMe = mine && e.miner.toLowerCase() === mine;
            return (
              <li
                key={e.txHash}
                className={`flex flex-wrap gap-x-3 border-b border-phosphor-faint/40 py-1 ${
                  isMe ? "text-phosphor term-glow" : "text-muted"
                }`}
              >
                <span className="w-24 shrink-0">blk {e.block.toString()}</span>
                <span className="w-16 shrink-0">era {e.era.toString()}</span>
                <span className="w-32 shrink-0">+{formatUnits(e.reward, 18)}</span>
                <span className="w-24 shrink-0 text-amber/80">🔥{formatUnits(e.burned, 18)}</span>
                <a
                  href={`${EXPLORER_BASE}/address/${e.miner}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-40 sm:w-56 truncate"
                >
                  {e.miner}
                </a>
                <a
                  href={`${EXPLORER_BASE}/tx/${e.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto"
                >
                  tx →
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
