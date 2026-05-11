"use client";

import { useEffect, useRef, useState } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { SATOSHIT_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS, ACTIVE_CHAIN, EXPLORER_BASE } from "@/lib/config";
import { buildChallenge, successProbLog10 } from "@/lib/pow";

type State =
  | { kind: "idle" }
  | { kind: "mining"; attempts: number; hashrate: number; startedAt: number }
  | { kind: "submitting"; nonce: string; hash: string }
  | { kind: "confirmed"; txHash: string }
  | { kind: "error"; message: string };

export function MinerPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onRightChain = chainId === ACTIVE_CHAIN.id;

  const [state, setState] = useState<State>({ kind: "idle" });
  const workerRef = useRef<Worker | null>(null);
  const attemptsRef = useRef(0);

  const { data: challenge } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SATOSHIT_ABI,
    functionName: "getChallenge",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 12_000 },
  });

  const { data: difficulty } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SATOSHIT_ABI,
    functionName: "currentDifficulty",
    query: { refetchInterval: 12_000 },
  });

  const { data: epoch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SATOSHIT_ABI,
    functionName: "currentEpoch",
    query: { refetchInterval: 12_000 },
  });

  const { writeContract, data: txHash, reset: resetWrite, isPending: writePending } = useWriteContract();
  const { isSuccess: txConfirmed, data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (txHash && txConfirmed) {
      setState({ kind: "confirmed", txHash });
    }
  }, [txHash, txConfirmed]);

  const stop = () => {
    workerRef.current?.postMessage({ type: "stop" });
    workerRef.current?.terminate();
    workerRef.current = null;
  };

  const start = () => {
    if (!address || !challenge || !difficulty || !isConnected) return;
    stop();
    setState({ kind: "mining", attempts: 0, hashrate: 0, startedAt: Date.now() });
    attemptsRef.current = 0;

    const w = new Worker(new URL("../workers/miner.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = w;

    const startNonce = "0x" + BigInt(Math.floor(Math.random() * 1e15)).toString(16);
    w.postMessage({
      type: "start",
      challenge: challenge,
      difficulty: "0x" + (difficulty as bigint).toString(16),
      startNonce,
    });

    w.onmessage = (ev: MessageEvent) => {
      const m = ev.data;
      if (m.type === "progress") {
        attemptsRef.current += m.attempts;
        setState({
          kind: "mining",
          attempts: attemptsRef.current,
          hashrate: m.hashrate,
          startedAt: (state as any).startedAt ?? Date.now(),
        });
      } else if (m.type === "found") {
        stop();
        setState({ kind: "submitting", nonce: m.nonce, hash: m.hash });
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
        stop();
        setState({ kind: "error", message: m.message });
      }
    };
  };

  useEffect(() => () => stop(), []);

  // Local sanity check: client-computed challenge should equal on-chain one.
  const localChallenge =
    address && epoch !== undefined
      ? buildChallenge(BigInt(chainId), CONTRACT_ADDRESS, address, epoch as bigint)
      : undefined;
  const challengeMismatch =
    !!localChallenge && !!challenge && localChallenge.toLowerCase() !== (challenge as string).toLowerCase();

  const expLog10 =
    difficulty !== undefined ? -successProbLog10(difficulty as bigint) : 0;

  return (
    <div className="ascii-box p-4 text-sm" data-label="[ miner ]">
      {!isConnected && <p className="text-muted">Connect wallet to start mining.</p>}
      {isConnected && !onRightChain && (
        <p className="text-amber">Wrong network. Switch to {ACTIVE_CHAIN.name} in the header.</p>
      )}
      {isConnected && onRightChain && challengeMismatch && (
        <p className="text-amber">
          Challenge mismatch — contract data not yet synced. Retrying…
        </p>
      )}

      {isConnected && onRightChain && !challengeMismatch && (
        <>
          <div className="text-xs text-muted mb-3 space-y-1 font-mono">
            <div>challenge: {challenge?.slice(0, 14)}…{challenge?.slice(-10)}</div>
            <div>exp. attempts per hit ≈ 10^{expLog10.toFixed(2)}</div>
          </div>

          {state.kind === "idle" && (
            <button
              onClick={start}
              className="px-4 py-2 border border-phosphor text-phosphor hover:bg-phosphor hover:text-black tracking-widest text-sm"
            >
              [ start mining ]
            </button>
          )}

          {state.kind === "mining" && (
            <div>
              <div className="text-phosphor term-glow mb-2">
                ⛏ mining · {state.hashrate.toFixed(0)} H/s · {state.attempts.toLocaleString()} attempts
              </div>
              <button
                onClick={() => {
                  stop();
                  setState({ kind: "idle" });
                }}
                className="px-4 py-2 border border-amber text-amber hover:bg-amber hover:text-black tracking-widest text-sm"
              >
                [ stop ]
              </button>
            </div>
          )}

          {state.kind === "submitting" && (
            <div className="text-phosphor">
              ✦ nonce found: {state.nonce.slice(0, 14)}…<br />
              {writePending ? "waiting for wallet signature…" : "submitting transaction…"}
            </div>
          )}

          {state.kind === "confirmed" && (
            <div className="text-phosphor">
              ✅ mined! tx:&nbsp;
              <a
                href={`${EXPLORER_BASE}/tx/${state.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {state.txHash.slice(0, 10)}…
              </a>
              <div className="mt-3">
                <button
                  onClick={() => {
                    resetWrite();
                    setState({ kind: "idle" });
                  }}
                  className="px-4 py-2 border border-phosphor text-phosphor hover:bg-phosphor hover:text-black"
                >
                  [ mine again ]
                </button>
              </div>
            </div>
          )}

          {state.kind === "error" && (
            <div className="text-amber">
              ✖ {state.message}
              <div className="mt-2">
                <button onClick={() => setState({ kind: "idle" })} className="underline">
                  reset
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
