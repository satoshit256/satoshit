export default function WhitepaperPage() {
  return (
    <article className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed">
      <header className="space-y-1">
        <h1 className="text-2xl term-glow uppercase tracking-widest">┌ whitepaper</h1>
        <p className="text-muted">
          SATOSHIT ($SHIT) — browser-mined ERC20 on Base. v0.2, 2026.
        </p>
      </header>

      <Section title="1. What this is">
        SATOSHIT is a fair-launch, browser-mined ERC20 experiment on the Base L2.
        The token has a 21,000,000 hard cap and enters circulation only through
        a keccak256 proof-of-work puzzle — the same kind Bitcoin uses, but small
        enough to solve on a phone or laptop CPU. Direct homage to Bitcoin's
        first year: no presale, no team allocation, no admin mint, no VC.
      </Section>

      <Section title="2. Why browser mining">
        Pure on-chain PoW tokens on L1 Ethereum are dominated by MEV bots and
        custom rigs. L2s are cheap enough that a human solving a puzzle in
        their browser tab can actually compete for a reward. This makes the
        distribution genuinely permissionless — anyone with a wallet and a few
        cents of ETH gas can participate from anywhere in the world.
      </Section>

      <Section title="3. Supply + emission + burn">
        <ul className="list-disc ml-5 space-y-1">
          <li>Max supply: <code>21,000,000 SHIT</code>, minted to the contract itself at deploy.</li>
          <li>Initial gross reward: <code>100 SHIT</code> per successful <code>mine()</code>.</li>
          <li>Era length: <code>100,000</code> mints. Reward halves each era (Bitcoin-style).</li>
          <li>Era 0: 100 · Era 1: 50 · Era 2: 25 · Era 3: 12.5 · …</li>
          <li>After 64 eras, reward is 0 — issuance halts permanently.</li>
          <li><b>Burn fee:</b> <code>1%</code> of every gross reward is burned on each mine
            (sent to the zero address and removed from <code>totalSupply</code>).
            Deflationary pressure from day one.</li>
          <li>So miner net-receives <code>99%</code> of the era's gross reward.
            The burn is immutable and cannot be changed.</li>
          <li>Any holder can also voluntarily burn their own tokens via <code>burn()</code>.</li>
        </ul>
      </Section>

      <Section title="4. Proof of work">
        A miner for address <code>M</code> at epoch <code>E</code> faces challenge:
        <pre className="bg-phosphor-faint/20 p-2 my-2 text-xs overflow-x-auto">
{`challenge = keccak256( abi.encode(chainId, contract, M, E) )`}
        </pre>
        and must find a nonce <code>n</code> such that:
        <pre className="bg-phosphor-faint/20 p-2 my-2 text-xs overflow-x-auto">
{`keccak256( abi.encode(challenge, n) ) < currentDifficulty`}
        </pre>
        The contract verifies both the challenge reconstruction and the inequality
        on-chain. Each (miner, nonce, epoch) tuple can be accepted exactly once.
      </Section>

      <Section title="5. Difficulty + epochs">
        Difficulty retargets every 2,016 successful mines (one Bitcoin epoch),
        scaled by how many blocks the last window took against a target of 5
        blocks per mint. Change is clamped to ×¼ … ×4 per retarget, preventing
        sudden cliffs. Each block caps successful mints at 10 to prevent
        single-block flash-floods. The per-miner challenge rotates every 100
        blocks (epoch), invalidating any nonce found in a stale epoch.
      </Section>

      <Section title="6. Security model">
        <ul className="list-disc ml-5 space-y-1">
          <li><b>No owner.</b> There is no admin role, no <code>Ownable</code>, no proxy, no delegatecall.</li>
          <li><b>No pause, no blacklist.</b> Tokens cannot be frozen, marked, or censored.</li>
          <li><b>No transfer fee.</b> Transfers are pure ERC20 — no hidden tax.</li>
          <li><b>No mint backdoor.</b> <code>_mint</code> is called exactly once in the constructor.
            <code>mine()</code> does <code>_transfer</code> + <code>_burn</code>, not <code>_mint</code>.</li>
          <li><b>ReentrancyGuard</b> on <code>mine()</code> — defense in depth.</li>
          <li><b>Invalid-miner guard:</b> <code>mine()</code> reverts if msg.sender is
            <code>address(0)</code> or the contract itself.</li>
          <li><b>Replay guard</b> on every proof keyed by (miner, nonce, epoch).</li>
          <li>Contract source is <b>MIT-licensed + public</b>.
            Every assumption here is enforced by tests (see repo).</li>
        </ul>
      </Section>

      <Section title="7. Risks">
        <ul className="list-disc ml-5 space-y-1">
          <li><b>Gas risk.</b> Every <code>mine()</code> costs real ETH. Finding a nonce does not mean profit.</li>
          <li><b>Difficulty risk.</b> As more miners compete, your share of reward falls.</li>
          <li><b>Smart contract risk.</b> This contract is unaudited. Bugs may exist.</li>
          <li><b>Chain risk.</b> Base is an L2. Reorgs, sequencer downtime, bridge issues can happen.</li>
          <li><b>Market risk.</b> SHIT has no liquidity, no listing, no price. It may never trade, or may trade at zero.</li>
        </ul>
      </Section>

      <Section title="8. Non-promises">
        No APY. No yield. No staking rewards. No roadmap. No airdrop. No partnerships.
        No &quot;utility.&quot; SATOSHIT is a toy-size experiment in fair-launch distribution.
        If you show up expecting returns, leave. If you find a bug, tell the world.
      </Section>

      <Section title="9. License">
        All contract source and frontend code are MIT-licensed. Fork it, read it,
        rip it apart. The contract is immutable once deployed — source and bytecode
        are the canonical specification.
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="ascii-box p-4" data-label={`[ ${title.toLowerCase()} ]`}>
      <h2 className="text-phosphor term-glow uppercase tracking-widest text-sm mb-2">{title}</h2>
      <div className="text-muted">{children}</div>
    </section>
  );
}
