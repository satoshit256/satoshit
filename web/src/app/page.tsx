import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <pre className="text-phosphor term-glow text-xs sm:text-sm leading-tight overflow-x-auto">
{`┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   ███████╗ █████╗ ████████╗ ██████╗ ███████╗██╗  ██╗██╗████████╗
│   ██╔════╝██╔══██╗╚══██╔══╝██╔═══██╗██╔════╝██║  ██║██║╚══██╔══╝
│   ███████╗███████║   ██║   ██║   ██║███████╗███████║██║   ██║
│   ╚════██║██╔══██║   ██║   ██║   ██║╚════██║██╔══██║██║   ██║
│   ███████║██║  ██║   ██║   ╚██████╔╝███████║██║  ██║██║   ██║
│   ╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝
│                                                              │
│                    💩  $SHIT  · on Base  ·  21M cap          │
└──────────────────────────────────────────────────────────────┘`}
        </pre>

        <h1 className="text-2xl sm:text-3xl term-glow uppercase tracking-widest">
          Mine SATOSHIT from your browser.
        </h1>
        <p className="text-muted text-sm sm:text-base">
          Phone or PC. No downloads. No GPU. keccak256 proof-of-work on Base.
          21,000,000 hard cap. No team. No presale. No admin.
        </p>
        <div className="flex gap-3 pt-2">
          <Link
            href="/mine"
            className="px-4 py-2 border border-phosphor text-phosphor hover:bg-phosphor hover:text-black tracking-widest text-sm"
          >
            [ start mining → ]
          </Link>
          <Link
            href="/whitepaper"
            className="px-4 py-2 border border-phosphor-faint text-muted hover:text-phosphor tracking-widest text-sm"
          >
            [ whitepaper ]
          </Link>
        </div>
      </section>

      <section className="ascii-box p-4" data-label="[ rules ]">
        <ul className="text-sm space-y-1 text-muted">
          <li><span className="text-phosphor">✓</span> ERC-20 on Base. 21,000,000 SHIT hard cap.</li>
          <li><span className="text-phosphor">✓</span> Every token enters circulation via <code>mine()</code>.</li>
          <li><span className="text-phosphor">✓</span> Reward halves every 100,000 mints (era).</li>
          <li><span className="text-phosphor">✓</span> Difficulty retargets every 2,016 mints.</li>
          <li><span className="text-phosphor">✓</span> Max 10 mints/block (anti-spam).</li>
          <li><span className="text-phosphor">✓</span> No owner. No pause. No blacklist. No fee. No mint backdoor.</li>
          <li><span className="text-amber">!</span> Gas is real. Profit is not promised. Read the risks below.</li>
        </ul>
      </section>

      <section className="ascii-box p-4" data-label="[ risks ]">
        <p className="text-sm text-muted">
          SATOSHIT is an <span className="text-amber">experiment</span>. You may spend
          ETH on gas and never mine a single token. Difficulty adapts. Smart contracts
          have bugs. This isn't financial advice, a promise, or an investment. Mine
          only what you're willing to lose on gas.
        </p>
      </section>
    </div>
  );
}
