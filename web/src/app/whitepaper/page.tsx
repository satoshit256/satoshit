export default function WhitepaperPage() {
  return (
    <article className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed">
      <header className="space-y-1">
        <h1 className="text-2xl term-glow uppercase tracking-widest">┌ whitepaper</h1>
        <p className="text-muted">
          SATOSHIT ($SHIT) — browser-mined ERC20 on Base. v0.1, 2026.
        </p>
      </header>

      <Section title="1. What this is">
        SATOSHIT is a fair-launch, browser-mined ERC20 experiment on the Base L2.
        The token has a 21,000,000 hard cap and enters circulation only through a
        keccak256 proof-of-work puzzle — the same kind Bitcoin uses, but small
        enough to solve on a phone or laptop CPU. The mechanic is a direct homage
        to Bitcoin's first year: no presale, no allocation to any team, no admin
        mint, no investor rounds, no VC.
      </Section>

      <Section title="2. Why browser mining">
        Pure on-chain PoW tokens on L1 Ethereum are dominated by MEV bots and
        custom mining rigs. L2s are cheap enough that a human solving a puzzle
        in their browser tab can actually compete for a reward. This makes the
        distribution genuinely permissionless — anyone with a wallet and a few
        cents of ETH gas can participate from anywhere.
      </Section>

      <Section title="3. Supply and emission">
        <ul className="list-disc ml-5 space-y-1">
          <li>Max supply: <code>21,000,000 SHIT</code> (minted to the contract itself at deploy).</li>
          <li>Initial reward: <code>100 SHIT</code> per successful <code>mine()</code>.</li>
          <li>Era length: <code>100,000</code> mints. Reward halves each era (Bitcoin-style).</li>
          <li>Era 0: 100 · Era 1: 50 · Era 2: 25 · Era 3: 12.5 · …</li>
          <li>After 64 eras, reward is 0. Contract effectively stops minting.</li>
        </ul>
      </Section>

      <Section title="4. Proof of work">
        A miner for address <code>M</code> at epoch <code>E</code> faces challenge
        <pre className="bg-phosphor-faint/20 p-2 my-2 text-xs overflow-x-auto">
{`challenge = keccak256( abi.encode(chainId, contract, M, E) )`}
        </pre>
        and must find a nonce <code>n</code> such that
        <pre className="bg-phosphor-faint/20 p-2 my-2 text-xs overflow-x-auto">
{`keccak256( abi.encode(challenge, n) ) < currentDifficulty`}
        </pre>
        The contract verifies both the challenge reconstruction and the inequality
        on-chain. Each (miner, nonce, epoch) tuple can only be accepted once.
      </Section>

      <Section title="5. Difficulty">
        Difficulty retargets every 2,016 successful mints (one Bitcoin epoch),
        scaled by how many blocks the last window took against a target of 5
        blocks per mint. Change is clamped to ×¼ … ×4 per retarget, preventing
        sudden cliffs. Each block caps successful mints at 10 to prevent single-block
        flash-floods.
      </Section>

      <Section title="6. Epochs">
        Every 100 blocks the challenge rotates to a new epoch automatically
        (<code>block.number / 100</code>). Any in-flight nonce you found in the
        previous epoch becomes invalid — submit fast, or resume mining on the
        new challenge.
      </Section>

      <Section title="7. What the contract cannot do">
        <ul className="list-disc ml-5 space-y-1">
          <li>No owner, no admin, no proxy. The deployed bytecode is the protocol.</li>
          <li>No pause, no blacklist, no whitelist.</li>
          <li>No transfer tax, no swap tax, no buy/sell fee.</li>
          <li>No hidden mint function. <code>mine()</code> is the only issuance path.</li>
          <li>No presale, no premint, no team allocation.</li>
        </ul>
      </Section>

      <Section title="8. Risks">
        <ul className="list-disc ml-5 space-y-1">
          <li><b>Gas risk.</b> Every <code>mine()</code> costs real ETH. Finding a nonce does not mean profit.</li>
          <li><b>Difficulty risk.</b> As more miners compete, your share of reward falls.</li>
          <li><b>Smart contract risk.</b> This contract is unaudited. Bugs may exist.</li>
          <li><b>Chain risk.</b> Base is an L2. Reorgs, sequencer downtime, bridge issues can happen.</li>
          <li><b>Market risk.</b> SHIT has no liquidity, no listing, no price. It may never trade. It may trade at zero.</li>
        </ul>
      </Section>

      <Section title="9. Non-promises">
        No APY. No yield. No staking rewards. No roadmap. No airdrop. No partnership.
        No &quot;utility.&quot; SATOSHIT is a toy-size experiment in fair-launch distribution.
        If you show up expecting returns, leave. If you find a bug, tell the world.
      </Section>

      <Section title="10. License">
        All contract source and frontend code are MIT-licensed. Fork it, read it,
        rip it apart. The contract is immutable once deployed.
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
