import { useDemo, DEMO } from "../aperture/DemoContext.tsx";
import { APERTURE } from "../aperture/config.ts";
import { fmt, short } from "../aperture/format.ts";
import "../styles/personas.css";

export function InstitutionView() {
  const { settlement, status, error, settle, reset } = useDemo();
  const busy = status === "proving" || status === "verifying";

  return (
    <div className="persona">
      <header className="persona__head">
        <span className="persona__role persona__role--issuer">Institution · Treasury</span>
        <h1>Settle a confidential transfer</h1>
        <p className="muted">You are the issuer. Amount and counterparty stay private on the public ledger — an authorized auditor can still verify them, and sanctioned actors are excluded.</p>
      </header>

      <div className="card">
        <div className="kv"><span>Counterparty</span><strong>{DEMO.counterparty} · KYC&apos;d</strong></div>
        <div className="kv"><span>Amount</span><strong>{fmt(DEMO.amount)} USDC</strong></div>
        <div className="kv"><span>On the public ledger</span><strong>amount + counterparty hidden</strong></div>

        {status !== "done" || !settlement ? (
          <>
            <button className="btn btn--primary" onClick={settle} disabled={busy}>
              {status === "proving" ? "Proving in your browser…" : status === "verifying" ? "Verifying on testnet…" : "Generate proof & settle on testnet"}
            </button>
            {busy && <p className="status-live"><span className="spinner" />{status === "proving" ? "Generating the Groth16 proof client-side (snarkjs / WASM)…" : "Submitting to the Soroban verifier on Stellar testnet…"}</p>}
          </>
        ) : (
          <>
            <div className="ok-row">✓ Proof generated client-side&nbsp;&nbsp;·&nbsp;&nbsp;✓ Verified on-chain</div>
            <a className="trust" href={settlement.tx.txHash ? APERTURE.explorerTx(settlement.tx.txHash) : "#"} target="_blank" rel="noreferrer">
              <span className="trust__check">✓ Settled on Stellar testnet</span>
              {settlement.tx.txHash && <span className="trust__tx">tx {short(settlement.tx.txHash)}</span>}
              <span className="trust__cta">view on explorer ↗</span>
            </a>
            <p className="muted">This settlement now lives on the public ledger as opaque commitments. Open <strong>Counterparty</strong>, <strong>Auditor</strong>, and <strong>Public Explorer</strong> to see each role&apos;s view of the same settlement.</p>
            <button className="btn btn--ghost btn--sm" onClick={reset}>↻ Reset demo</button>
          </>
        )}
        {error && <p className="error">⚠ {error}</p>}
      </div>
    </div>
  );
}
