"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBlockNumber,
} from "wagmi";
import { SATOSHIT_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS, ACTIVE_CHAIN, EXPLORER_BASE } from "@/lib/config";
import { buildChallenge, successProbLog10 } from "@/lib/pow";
import { formatUnits } from "viem";

type MinerState =
  | { kind: "idle" }
  | { kind: "mining"; attempts: number; hashrate: number; startedAt: number }
  | { kind: "awaiting_signature"; nonce: string }
  | { kind: "submitting"; nonce: string }
  | { kind: "confirmed"; txHash: string; mined: bigint; burned: bigint }
  | { kind: "error"; message: string };

type SessionStats = {
  mines: number;
  netEarned: bigint;
  burned: bigint;
  gasSpent: bigint;
  startedAt: number;
};

export function MinerPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onRightChain = chainId === ACTIVE_CHAIN.id;

  const [autoMine, setAutoMine] = useState(false);
  const autoMineRef = useRef(false);
  useEffect(() => { autoMineRef.current = autoMine; }, [autoMine]);

  const [state, setState] = useState<MinerState>({ kind: "idle" });
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const [session, setSession] = useState<SessionStats>({
    mines: 0,
    netEarned: 0n,
    burned: 0n,
    gasSpent: 0n,
    startedAt: 0,
  });

  const workerRef = useRef<Worker | null>(null);
  const attemptsRef = useRef(0);
  const minedEpochRef = useRef<bigint | null>(null);

  const { data: block } = useBlockNumber({ watch: true });

  const { data: challenge, refetch: refetchChallenge } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SATOSHIT_ABI,
    functionName: "getChallenge",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });

  const { data: difficulty, refetch: refetchDifficulty } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SATOSHIT_ABI,
    functionName: "currentDifficulty",
    query: { refetchInterval: 12_000 },
  });

  const { data: epoch, refetch: refetchEpoch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SATOSHIT_ABI,
    functionName: "currentEpoch",
    query: { refetchInterval: 12_000 },
  });

  const {
    writeContract,
    data: txHash,
    reset: resetWrite,
    isPending: writePending,
    error: writeError,
  } = useWriteContract();

  const { isSuccess: txConfirmed, isError: txFailed, data: receipt } =
    useWaitForTransactionReceipt({ hash: txHash, confirmations: 1 });

  const stopWorker = useCallback(() => {
    workerRef.current?.postMessage({ type: "stop" });
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopWorker(), [stopWorker]);

  // Start worker for one attempt
  const startOneAttempt = useCallback(
    (chalHex: string, diff: bigint, minerAddr: string, currEpoch: bigint) => {
      stopWorker();
      minedEpochRef.current = currEpoch;
      attemptsRef.current = 0;
      setState({ kind: "mining", attempts: 0, hashrate: 0, startedAt: Date.now() });

      const w = new Worker(new URL("../workers/miner.worker.ts", import.meta.url), {
        type: "module",
      });
      workerRef.current = w;

      const startNonce = "0x" + BigInt(Math.floor(Math.random() * 1e15)).toString(16);
      w.postMessage({
        type: "start",
        challenge: chalHex,
        difficulty: "0x" + diff.toString(16),
        startNonce,
      });

      w.onmessage = (ev: MessageEvent) => {
        const m = ev.data;
        if (m.type === "progress") {
          attemptsRef.current += m.attempts;
          const prev = stateRef.current;
          if (prev.kind === "mining") {
            setState({
              kind: "mining",
              attempts: attemptsRef.current,
              hashrate: m.hashrate,
              startedAt: prev.startedAt,
            });
          }
        } else if (m.type === "found") {
          stopWorker();
          setState({ kind: "awaiting_signature", nonce: m.nonce });
          try {
            writeContract({
              address: CONTRACT_ADDRESS,
              abi: SATOSHIT_ABI,
              functionName: "mine",
              args: [BigInt(m.nonce)],
            });
          } catch (e) {
            setState({ kind: "error", message: (e as Error).message });
          }
        } else if (m.type === "error") {
          stopWorker();
          setState({ kind: "error", message: m.message });
        }
      };
    },
    [stopWorker, writeContract],
  );

  // React to writeContract transitions
  useEffect(() => {
    if (txHash && !txConfirmed && !txFailed) {
      const prev = stateRef.current;
      if (prev.kind === "awaiting_signature" || prev.kind === "mining") {
        setState({ kind: "submitting", nonce: prev.kind === "awaiting_signature" ? prev.nonce : "" });
      }
    }
  }, [txHash, txConfirmed, txFailed]);

  // React to writeContract errors (user rejected in wallet, revert, etc.)
  useEffect(() => {
    if (writeError) {
      const msg = (writeError as Error).message || "wallet error";
      setState({ kind: "error", message: msg.slice(0, 140) });
    }
  }, [writeError]);

  // When tx confirmed, parse Mined event for accurate stats + refresh chain reads
  useEffect(() => {
    if (!(txHash && txConfirmed && receipt)) return;

    // Parse Mined event (topic0 = keccak256("Mined(address,uint256,uint256,uint256,uint256,uint256)"))
    // Use lib/abi parsing: iterate logs, find one matching our address + signature
    const minedLog = receipt.logs.find(
      (l) => l.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase(),
    );
    let rewardPaid = 0n;
    let burned = 0n;
    try {
      if (minedLog && minedLog.data && minedLog.data.length >= 2 + 64 * 5) {
        const hex = minedLog.data.slice(2);
        // Mined non-indexed fields (in order after indexed miner):
        // nonce(32), rewardPaid(32), burned(32), era(32), epoch(32)
        rewardPaid = BigInt("0x" + hex.slice(64, 128));
        burned = BigInt("0x" + hex.slice(128, 192));
      }
    } catch {
      // ignore parse errors — session stats fall back to zero for this mine
    }

    const gasUsed = receipt.gasUsed ?? 0n;
    const gasPrice = receipt.effectiveGasPrice ?? 0n;
    const gasCost = gasUsed * gasPrice;

    setSession((s) => ({
      mines: s.mines + 1,
      netEarned: s.netEarned + rewardPaid,
      burned: s.burned + burned,
      gasSpent: s.gasSpent + gasCost,
      startedAt: s.startedAt || Date.now(),
    }));

    setState({ kind: "confirmed", txHash, mined: rewardPaid, burned });

    // Refresh on-chain reads so challenge/difficulty/epoch are fresh
    refetchChallenge();
    refetchDifficulty();
    refetchEpoch();

    // If auto-mine is on, loop after short pause
    if (autoMineRef.current) {
      const t = setTimeout(() => {
        const a = address;
        if (!a) return;
        // Pull latest values right before looping
        Promise.all([refetchChallenge(), refetchDifficulty(), refetchEpoch()]).then(
          ([c, d, e]) => {
            if (!autoMineRef.current) return;
            if (c.data && d.data !== undefined && e.data !== undefined) {
              resetWrite();
              startOneAttempt(c.data as string, d.data as bigint, a, e.data as bigint);
            }
          },
        );
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [txHash, txConfirmed, receipt, address, refetchChallenge, refetchDifficulty, refetchEpoch, resetWrite, startOneAttempt]);

  // User action: start mining (manual or auto)
  const start = useCallback(
    (loop: boolean) => {
      if (!address || !challenge || !difficulty || epoch === undefined || !isConnected) return;
      setAutoMine(loop);
      resetWrite();
      setSession((s) =>
        s.mines === 0 ? { ...s, startedAt: Date.now() } : s,
      );
      startOneAttempt(
        challenge as string,
        difficulty as bigint,
        address,
        epoch as bigint,
      );
    },
    [address, challenge, difficulty, epoch, isConnected, resetWrite, startOneAttempt],
  );

  const stop = useCallback(() => {
    setAutoMine(false);
    autoMineRef.current = false;
    stopWorker();
    setState({ kind: "idle" });
  }, [stopWorker]);

  // Local sanity check: client-computed challenge must equal on-chain one.
  const localChallenge =
    address && epoch !== undefined
      ? buildChallenge(BigInt(chainId), CONTRACT_ADDRESS, address, epoch as bigint)
      : undefined;
  const challengeMismatch =
    !!localChallenge &&
    !!challenge &&
    localChallenge.toLowerCase() !== (challenge as string).toLowerCase();

  const expLog10 =
    difficulty !== undefined ? -successProbLog10(difficulty as bigint) : 0;

  const sessionTime =
    session.startedAt === 0 ? 0 : (Date.now() - session.startedAt) / 1000;

  return (
    <div className="ascii-box p-4 text-sm" data-label="[ miner ]">
      {!isConnected && <p className="text-muted">Connect wallet to start mining.</p>}
      {isConnected && !onRightChain && (
        <p className="text-amber">Wrong network. Switch to {ACTIVE_CHAIN.name} in the header.</p>
      )}
      {isConnected && onRightChain && challengeMismatch && (
        <p className="text-amber">
          Challenge mismatch — chain state syncing, retrying…
        </p>
      )}

      {isConnected && onRightChain && !challengeMismatch && (
        <>
          <div className="text-xs text-muted mb-3 space-y-1 font-mono">
            <div>challenge: {challenge?.slice(0, 14)}…{challenge?.slice(-10)}</div>
            <div>block: {block?.toString() ?? "…"}  •  epoch: {epoch?.toString() ?? "…"}</div>
            <div>exp. attempts per hit ≈ 10^{expLog10.toFixed(2)}</div>
          </div>

          {/* Idle — both start buttons */}
          {state.kind === "idle" && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => start(true)}
                className="px-4 py-2 border border-phosphor text-phosphor hover:bg-phosphor hover:text-black tracking-widest text-sm"
              >
                [ ▶ auto-mine ]
              </button>
              <button
                onClick={() => start(false)}
                className="px-4 py-2 border border-phosphor-dim text-phosphor-dim hover:text-phosphor tracking-widest text-sm"
              >
                [ mine once ]
              </button>
            </div>
          )}

          {/* Mining */}
          {state.kind === "mining" && (
            <div>
              <div className="text-phosphor term-glow mb-2">
                ⛏ mining · {state.hashrate.toFixed(0)} H/s · {state.attempts.toLocaleString()} attempts
                {autoMine && <span className="text-amber ml-2">[ auto ]</span>}
              </div>
              <button
                onClick={stop}
                className="px-4 py-2 border border-amber text-amber hover:bg-amber hover:text-black tracking-widest text-sm"
              >
                [ stop ]
              </button>
            </div>
          )}

          {/* Awaiting user signature */}
          {state.kind === "awaiting_signature" && (
            <div className="text-amber">
              ✦ nonce found: {state.nonce.slice(0, 14)}…
              <div className="mt-1 text-sm">
                {writePending
                  ? "→ check your wallet: approve the mine() tx"
                  : "submitting…"}
              </div>
              <button
                onClick={stop}
                className="mt-3 px-3 py-1 border border-phosphor-dim text-phosphor-dim text-xs"
              >
                cancel
              </button>
            </div>
          )}

          {/* Submitting */}
          {state.kind === "submitting" && (
            <div className="text-phosphor">
              📡 tx broadcast, waiting for confirmation…{" "}
              {txHash && (
                <a
                  href={`${EXPLORER_BASE}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline ml-1"
                >
                  view
                </a>
              )}
            </div>
          )}

          {/* Confirmed */}
          {state.kind === "confirmed" && (
            <div className="text-phosphor">
              ✅ mined {formatUnits(state.mined, 18)} SHIT
              {state.burned > 0n && (
                <span className="text-amber ml-1">
                  (+ {formatUnits(state.burned, 18)} burned 🔥)
                </span>
              )}
              <div className="text-xs text-muted">
                tx:{" "}
                <a
                  href={`${EXPLORER_BASE}/tx/${state.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {state.txHash.slice(0, 12)}…
                </a>
                {autoMine && <span className="ml-2 text-amber">auto-mining continues…</span>}
              </div>
              {!autoMine && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => start(true)}
                    className="px-3 py-1 border border-phosphor text-phosphor hover:bg-phosphor hover:text-black"
                  >
                    [ ▶ auto-mine ]
                  </button>
                  <button
                    onClick={() => start(false)}
                    className="px-3 py-1 border border-phosphor-dim text-phosphor-dim"
                  >
                    [ mine again ]
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {state.kind === "error" && (
            <div className="text-amber">
              ✖ {state.message}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => {
                    resetWrite();
                    setState({ kind: "idle" });
                  }}
                  className="px-3 py-1 border border-phosphor-dim text-phosphor-dim underline"
                >
                  reset
                </button>
                <button
                  onClick={() => {
                    resetWrite();
                    start(autoMine);
                  }}
                  className="px-3 py-1 border border-phosphor text-phosphor"
                >
                  retry
                </button>
              </div>
            </div>
          )}

          {/* Session stats */}
          {session.mines > 0 && (
            <div className="mt-5 pt-3 border-t border-phosphor-faint/40 text-xs grid grid-cols-2 gap-x-6 gap-y-1">
              <div className="text-muted">session mines</div>
              <div className="text-phosphor text-right">{session.mines}</div>
              <div className="text-muted">net earned</div>
              <div className="text-phosphor text-right">{formatUnits(session.netEarned, 18)} SHIT</div>
              <div className="text-muted">burned</div>
              <div className="text-amber text-right">{formatUnits(session.burned, 18)} SHIT 🔥</div>
              <div className="text-muted">gas spent</div>
              <div className="text-phosphor text-right">
                {Number(formatUnits(session.gasSpent, 18)).toFixed(6)} ETH
              </div>
              <div className="text-muted">elapsed</div>
              <div className="text-phosphor text-right">
                {sessionTime > 60
                  ? `${Math.floor(sessionTime / 60)}m ${Math.floor(sessionTime % 60)}s`
                  : `${Math.floor(sessionTime)}s`}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
