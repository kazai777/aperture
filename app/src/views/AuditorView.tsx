import { useState } from "react";
import { useDemo, DEMO } from "../aperture/DemoContext.tsx";
import { auditRecover, type AuditOutcome } from "../aperture/client.ts";
import { APERTURE } from "../aperture/config.ts";
import { fmt, short } from "../aperture/format.ts";
import "../styles/personas.css";

export function AuditorView() {
  const { settlement } = useDemo();
  const [keyInput, setKeyInput] = useState("");
  const [revealed, setRevealed] = useState<AuditOutcome | null>(null);

  async function tryReveal() {
    if (!settlement) return;
    let key: bigint;
    try { key = BigInt(keyInput.trim()); } catch { setRevealed({ amount: null, ok: false, reason: "not a valid key" }); return; }
    setRevealed(await auditRecover(key, settlement.bundle.disclosedValue, settlement.bundle.nullifier, settlement.bundle.viewKeyCommitment));
  }

  return (
    <div className="persona">
      <header className="persona__head">
        <span className="persona__role persona__role--auditor">Auditor · Compliance</span>
        <h1>Recover the disclosed amount</h1>
        <p className="muted">With the view key you independently recompute the settled amount and reconcile it against the on-chain-verified proof. Without it, the value stays sealed.</p>
      </header>

      {!settlement ? (
        <div className="empty">
          <p>Nothing to audit yet.</p>
          <p className="muted">The issuer settles in the <strong>Institution</strong> view first.</p>
        </div>
      ) : (
        <div className="card">
          <div className={`amount-box ${revealed?.ok ? "amount-box--revealed" : "amount-box--sealed"}`}>
            <span className="amount-box__cap">disclosed amount</span>
            {revealed?.ok
              ? <span key={String(revealed.amount)} className="amount-value">{fmt(revealed.amount as bigint)} <small>USDC</small></span>
              : <span className="blackbox">●●●●●●●● USDC</span>}
          </div>

          <div className="keyentry">
            <input
              className="keyentry__input"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="enter the view key"
              onKeyDown={(e) => { if (e.key === "Enter") tryReveal(); }}
            />
            <button className="btn btn--primary btn--sm" onClick={tryReveal}>Reveal &amp; reconcile</button>
          </div>
          <p className="hint">
            Type a wrong key and watch it stay sealed — then reveal with the{" "}
            <button className="linkbtn" onClick={() => setKeyInput(String(DEMO.viewKey))}>auditor&apos;s key</button>.
          </p>
          {revealed?.ok && (
            <p className="reconcile">
              ✓ Recomputed value matches the amount the on-chain proof committed to
              {settlement.tx.txHash
                ? <> · <a className="tx-link" href={APERTURE.explorerTx(settlement.tx.txHash)} target="_blank" rel="noreferrer">verify tx {short(settlement.tx.txHash)} ↗</a></>
                : null}
            </p>
          )}
          {revealed && !revealed.ok && (
            <p className="reject-inline">✗ Wrong view key — the amount stays sealed. The auditor is <strong>never fooled</strong>.</p>
          )}
        </div>
      )}
    </div>
  );
}
