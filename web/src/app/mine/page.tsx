import { MiningDashboard } from "@/components/MiningDashboard";
import { MinerPanel } from "@/components/MinerPanel";

export default function MinePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl term-glow uppercase tracking-widest">┌ mine</h1>
        <p className="text-sm text-muted max-w-3xl">
          Brute-force keccak256 in your browser tab. Challenge rotates every{" "}
          <code>EPOCH_BLOCKS = 100</code> blocks. Reward halves every{" "}
          <code>ERA_MINTS = 100,000</code> mints.
        </p>
      </header>

      <MiningDashboard />
      <MinerPanel />

      <section className="ascii-box p-4 text-xs text-muted" data-label="[ how it works ]">
        <pre className="whitespace-pre-wrap leading-relaxed">
{`challenge = keccak256( abi.encode( chainId, contract, miner, epoch ) )
valid if  = keccak256( abi.encode( challenge, nonce ) ) < currentDifficulty
submit    = satoshit.mine( nonce )

Each (miner, nonce, epoch) tuple can only be used once. Finding a nonce
on a CPU may take seconds, minutes, or hours depending on difficulty.
Gas is paid by the miner. Reward transfers from contract to miner on success.`}
        </pre>
      </section>
    </div>
  );
}
