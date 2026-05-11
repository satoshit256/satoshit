import { encodeAbiParameters, keccak256, type Address, type Hex } from "viem";

/**
 * Reproduce on-chain challenge:
 *   keccak256(abi.encode(chainId, contract, miner, epoch))
 */
export function buildChallenge(
  chainId: bigint,
  contractAddress: Address,
  miner: Address,
  epoch: bigint,
): Hex {
  const encoded = encodeAbiParameters(
    [
      { type: "uint256" },
      { type: "address" },
      { type: "address" },
      { type: "uint256" },
    ],
    [chainId, contractAddress, miner, epoch],
  );
  return keccak256(encoded);
}

/**
 * Pretty-print a difficulty value: show log2 rough estimate so humans can read it.
 */
export function formatDifficulty(diff: bigint): string {
  if (diff === 0n) return "0";
  // approximate log2(diff) via bit length
  let bits = 0n;
  let d = diff;
  while (d > 0n) {
    d >>= 1n;
    bits++;
  }
  return `2^${bits.toString()}`;
}

/** Fraction of 2^256 that a random 256-bit value has of being < diff. */
export function successProbLog10(diff: bigint): number {
  if (diff === 0n) return -Infinity;
  // log10(diff) - 256*log10(2)
  const s = diff.toString();
  const head = Number(s.slice(0, Math.min(s.length, 15)));
  const logHead = Math.log10(head);
  const logDiff = s.length - Math.min(s.length, 15) + logHead;
  return logDiff - 256 * Math.log10(2);
}
