export const SATOSHIT_ABI = [
  // reads
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },

  { type: "function", name: "MAX_SUPPLY", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "BASE_REWARD", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "ERA_MINTS", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "EPOCH_BLOCKS", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "ADJUSTMENT_INTERVAL", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "MAX_MINTS_PER_BLOCK", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "GENESIS_BLOCK", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },

  { type: "function", name: "totalMints", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "currentDifficulty", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "currentEpoch", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "currentEra", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "currentReward", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "minedSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "remainingSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "mintsUntilRetarget", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "blocksUntilNextEpoch", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getChallenge", stateMutability: "view", inputs: [{ name: "miner", type: "address" }], outputs: [{ type: "bytes32" }] },

  // writes
  { type: "function", name: "mine", stateMutability: "nonpayable", inputs: [{ name: "nonce", type: "uint256" }], outputs: [] },

  // events
  { type: "event", name: "Mined", inputs: [
      { indexed: true, name: "miner", type: "address" },
      { indexed: false, name: "nonce", type: "uint256" },
      { indexed: false, name: "reward", type: "uint256" },
      { indexed: false, name: "era", type: "uint256" },
      { indexed: false, name: "epoch", type: "uint256" },
    ]
  },
  { type: "event", name: "DifficultyAdjusted", inputs: [
      { indexed: false, name: "fromDiff", type: "uint256" },
      { indexed: false, name: "toDiff", type: "uint256" },
      { indexed: false, name: "blocksTaken", type: "uint256" },
    ]
  },
  { type: "event", name: "Halving", inputs: [
      { indexed: false, name: "era", type: "uint256" },
      { indexed: false, name: "newReward", type: "uint256" },
    ]
  },
] as const;
