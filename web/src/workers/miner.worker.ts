/// <reference lib="webworker" />
// Web Worker: brute-force a nonce so that
//   keccak256(abi.encode(bytes32 challenge, uint256 nonce)) < difficulty
//
// Uses a tiny, dependency-free keccak-f[1600] implementation so this file
// can be loaded without a bundler. Messages:
//   in:  { type: "start", challenge: hex, difficulty: hex, startNonce: hex }
//        { type: "stop" }
//   out: { type: "progress", attempts: number, hashrate: number }
//        { type: "found", nonce: hex, hash: hex }
//        { type: "error", message: string }

type InMsg =
  | { type: "start"; challenge: string; difficulty: string; startNonce: string }
  | { type: "stop" };

type OutMsg =
  | { type: "progress"; attempts: number; hashrate: number }
  | { type: "found"; nonce: string; hash: string }
  | { type: "error"; message: string };

// ---------- keccak-f[1600] / keccak256 (pure JS, deterministic) ----------
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const R = [
  [0n, 36n, 3n, 41n, 18n],
  [1n, 44n, 10n, 45n, 2n],
  [62n, 6n, 43n, 15n, 61n],
  [28n, 55n, 25n, 21n, 56n],
  [27n, 20n, 39n, 8n, 14n],
];
const MASK = (1n << 64n) - 1n;
const rotL = (x: bigint, n: bigint) => ((x << n) | (x >> (64n - n))) & MASK;

function keccakF(state: BigUint64Array) {
  const s: bigint[][] = Array.from({ length: 5 }, () => new Array(5).fill(0n));
  for (let x = 0; x < 5; x++)
    for (let y = 0; y < 5; y++) s[x][y] = state[x + 5 * y];

  for (let round = 0; round < 24; round++) {
    // theta
    const C = new Array<bigint>(5);
    for (let x = 0; x < 5; x++)
      C[x] = s[x][0] ^ s[x][1] ^ s[x][2] ^ s[x][3] ^ s[x][4];
    const D = new Array<bigint>(5);
    for (let x = 0; x < 5; x++)
      D[x] = C[(x + 4) % 5] ^ rotL(C[(x + 1) % 5], 1n);
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++) s[x][y] ^= D[x];

    // rho + pi
    const B: bigint[][] = Array.from({ length: 5 }, () => new Array(5).fill(0n));
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++)
        B[y][(2 * x + 3 * y) % 5] = rotL(s[x][y], R[x][y]);

    // chi
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++)
        s[x][y] = B[x][y] ^ (~B[(x + 1) % 5][y] & B[(x + 2) % 5][y] & MASK);

    // iota
    s[0][0] ^= RC[round];
  }

  for (let x = 0; x < 5; x++)
    for (let y = 0; y < 5; y++) state[x + 5 * y] = s[x][y] & MASK;
}

// keccak256 of a 64-byte input (our case): abi.encode(bytes32, uint256) = 64 bytes.
// Rate = 136 bytes, so 64 bytes pad with 0x01..0x80, all in one block.
function keccak256_64(input: Uint8Array): Uint8Array {
  const state = new BigUint64Array(25);
  // absorb: 136-byte rate. We have 64 bytes of input + padding.
  const block = new Uint8Array(136);
  block.set(input, 0);
  block[64] = 0x01;
  block[135] = 0x80;

  const view = new DataView(block.buffer);
  for (let i = 0; i < 17; i++) {
    // little-endian 64-bit
    const lo = BigInt(view.getUint32(i * 8, true));
    const hi = BigInt(view.getUint32(i * 8 + 4, true));
    state[i] ^= (hi << 32n) | lo;
  }
  keccakF(state);

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 4; i++) {
    const v = state[i];
    outView.setUint32(i * 8, Number(v & 0xffffffffn), true);
    outView.setUint32(i * 8 + 4, Number((v >> 32n) & 0xffffffffn), true);
  }
  return out;
}

// ---------- Mining loop ----------
let running = false;

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

function bigintTo32BE(n: bigint): Uint8Array {
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

function bytesToHex(b: Uint8Array): string {
  let s = "0x";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s;
}

function bytesLt(a: Uint8Array, b: Uint8Array): boolean {
  for (let i = 0; i < 32; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}

function post(msg: OutMsg) {
  (self as unknown as Worker).postMessage(msg);
}

function startMining(challengeHex: string, difficultyHex: string, startHex: string) {
  try {
    const challenge = hexToBytes(challengeHex);
    if (challenge.length !== 32) throw new Error("challenge must be 32 bytes");
    const diffBytes = bigintTo32BE(BigInt(difficultyHex));

    const input = new Uint8Array(64);
    input.set(challenge, 0);

    let nonce = BigInt(startHex);
    let attempts = 0;
    let lastReport = performance.now();
    running = true;

    const loop = () => {
      if (!running) return;
      const batch = 5000;
      for (let i = 0; i < batch; i++) {
        // write nonce as big-endian 256-bit in bytes 32..64
        // Only fill lower 8 bytes to keep GC low (upper stays 0 since we zero-init).
        const lo = nonce & 0xffffffffffffffffn;
        const view = new DataView(input.buffer, 32, 32);
        // zero upper 24 bytes
        for (let k = 0; k < 24; k++) view.setUint8(k, 0);
        // lower 8 bytes big-endian
        for (let k = 7; k >= 0; k--) view.setUint8(24 + k, Number(lo >> BigInt((7 - k) * 8) & 0xffn));

        const h = keccak256_64(input);
        if (bytesLt(h, diffBytes)) {
          running = false;
          post({ type: "found", nonce: "0x" + nonce.toString(16), hash: bytesToHex(h) });
          return;
        }
        nonce++;
        attempts++;
      }
      const now = performance.now();
      if (now - lastReport > 1500) {
        const hps = (attempts * 1000) / (now - lastReport);
        post({ type: "progress", attempts, hashrate: hps });
        attempts = 0;
        lastReport = now;
      }
      // Yield to event loop so stop/messages can arrive.
      setTimeout(loop, 0);
    };

    loop();
  } catch (e) {
    post({ type: "error", message: (e as Error).message });
  }
}

self.addEventListener("message", (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  if (msg.type === "start") {
    startMining(msg.challenge, msg.difficulty, msg.startNonce);
  } else if (msg.type === "stop") {
    running = false;
  }
});

export {};
