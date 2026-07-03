import { useDemo } from "../aperture/DemoContext.tsx";
import { APERTURE } from "../aperture/config.ts";
import { fmt, short } from "../aperture/format.ts";
import "../styles/personas.css";

export function CounterpartyView() {
  const { settlement } = useDemo();

  return (
    <div className="persona">
      <header className="persona__head">
        <span className="persona__role persona__role--party">Counterparty</span>
        <h1>Incoming confidential settlement</h1>
        <p className="muted">As a party to the transfer you know the amount. The public ledger does not — it sees only a commitment.</p>
      </header>

      {!settlement ? (
        <div className="empty">
          <p>No incoming settlement yet.</p>
          <p className="muted">The issuer settles in the <strong>Institution</strong> view; it appears here instantly.</p>
        </div>
      ) : (
        <div className="card">
          <div className="received">
            <span className="received__cap">You received from the issuer</span>
            <span className="received__amt">{fmt(settlement.amount)} <small>USDC</small></span>
            <span className="received__sub">confidential · settled on Stellar testnet</span>
          </div>
          <div className="kv">
            <span>Settlement tx</span>
            {settlement.tx.txHash
              ? <a className="tx-link" href={APERTURE.explorerTx(settlement.tx.txHash)} target="_blank" rel="noreferrer">verify {short(settlement.tx.txHash)} ↗</a>
              : <code>verified</code>}
          </div>
          <div className="kv"><span>On-chain reference (nullifier)</span><code>{short(settlement.bundle.nullifier.toString())}</code></div>
          <div className="kv"><span>Public sees the amount as</span><code>🔒 sealed ciphertext</code></div>
          <p className="muted">Only you, the issuer, and an auditor holding the view key can see {fmt(settlement.amount)} USDC. To everyone else this is an opaque commitment.</p>
        </div>
      )}
    </div>
  );
}
