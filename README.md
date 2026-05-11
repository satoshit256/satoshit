# 💩 SATOSHIT — Browser-Mined ERC20 on Base

> Mine SATOSHIT from your browser. Phone or PC. No downloads. No GPU.

SATOSHIT (SHIT) is a **fair-launch, browser-mined, no-presale, no-admin** ERC20 experiment on Base.
21 million hard cap. Bitcoin-style halving. Keccak256 proof-of-work.

This is an **experiment**. You may lose ETH on gas. You may mine zero tokens. There is no promised profit, no APY, no team, no VC. Read the whitepaper.

---

## Repo layout

```
satoshit/
├── contracts/               Foundry project (Solidity)
│   ├── src/Satoshit.sol     ERC20 + PoW + halving + retarget
│   ├── script/Deploy.s.sol  Deploy to Base Sepolia / Base mainnet
│   └── test/Satoshit.t.sol  Unit tests
├── web/                     Next.js 14 App Router + wagmi + RainbowKit
│   ├── src/app/             Pages: /, /mine, /pool, /stats, /whitepaper
│   ├── src/components/      UI (Header, WalletButton, MiningDashboard)
│   ├── src/lib/             abi, chains, config, keccak helpers
│   └── src/workers/         miner.worker.ts (brute-force nonce)
└── .env.example
```

---

## Quickstart

### Prereqs
- Node.js 20+
- `foundryup` (https://book.getfoundry.sh/)
- A funded private key on Base Sepolia (free ETH: https://docs.base.org/chain/network-faucets)
- WalletConnect Cloud project ID (https://cloud.walletconnect.com/)
- Basescan API key (https://basescan.org/myapikey)

### 1. Install contracts

```bash
cd contracts
forge install foundry-rs/forge-std --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge build
forge test
```

### 2. Deploy (Base Sepolia first)

```bash
cp ../.env.example .env
# edit .env: PRIVATE_KEY, BASE_SEPOLIA_RPC, BASESCAN_API_KEY
source .env
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_SEPOLIA_RPC \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY
```

Copy the deployed address, then update `web/.env.local`:

```
NEXT_PUBLIC_SATOSHIT_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=84532   # 8453 for mainnet
```

### 3. Run frontend

```bash
cd web
cp .env.example .env.local
# edit .env.local: fill WalletConnect ID and contract address
npm install
npm run dev
```

Open http://localhost:3000/mine.

### 4. Deploy to Base mainnet

Same command as step 2 but use `$BASE_MAINNET_RPC`. Double-check gas — mainnet costs real ETH.

---

## How it works

**Challenge**
```
challenge = keccak256(abi.encode(chainId, contract, minerAddr, epoch))
epoch     = block.number / 100
```

**Valid nonce**
```
keccak256(abi.encode(challenge, nonce)) < currentDifficulty
```

**Submit**
```
satoshit.mine(nonce)
```

On success: contract verifies the proof, increments `totalMints`, transfers `currentReward()` SHIT from the contract to the miner. Each proof can only be used once (per epoch).

### Reward schedule
- Era `n` = `totalMints / 100_000`
- Reward = `BASE_REWARD >> era` (halves every 100k mints)
- Era 0: 100 SHIT — Era 1: 50 — Era 2: 25 — …

### Difficulty retarget
- Every 2,016 mints, difficulty is rescaled so target time = `2016 * 5` blocks between retargets.
- Bounded [÷4, ×4] per retarget (like Bitcoin).

### Caps
- Hard cap: **21,000,000 SHIT** total.
- No `mint()` for owner. No presale. No blacklist. No tax. No pause.

---

## Risks (read this)

1. **Gas costs real money.** Every `mine()` transaction on Base costs ETH, even if you find a valid nonce. On a busy network, gas may exceed the USD value of reward.
2. **Difficulty adapts.** If a lot of people mine, difficulty rises and your hash rate's share of reward falls.
3. **Browser CPU is slow.** Expect hours-to-days per successful mint on a phone or laptop.
4. **Smart contract bugs.** The contract is unaudited. Treat it as experimental software.
5. **No profit promise.** This is a toy / experiment / art. Do not mine with money you cannot afford to lose on gas.

---

## License
MIT. Use at your own risk. Not financial advice.
