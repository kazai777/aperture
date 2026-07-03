import { useDemo } from "../aperture/DemoContext.tsx";
import { APERTURE } from "../aperture/config.ts";
import { short } from "../aperture/format.ts";
import "../styles/personas.css";

export function PublicExplorerView() {
  const { settlement } = useDemo();

  return (
    <div className="persona">
      <header className="persona__head">
        <span className="persona__role persona__role--public">Public · Stellar testnet</span>
        <h1>What the public ledger reveals</h1>
        <p className="muted">Everything an unprivileged observer can see. The amount and counterparty are not here — that is the whole point.</p>
      </header>

      {!settlement ? (
        <div className="empty">
          <p>No settlements indexed yet.</p>
          <p className="muted">The issuer settles in the <strong>Institution</strong> view.</p>
        </div>
      ) : (
        <div className="card">
          <table className="ledger">
            <tbody>
              <tr>
                <td>Verification tx</td>
                <td>
                  {settlement.tx.txHash
                    ? <a className="ledger__link" href={APERTURE.explorerTx(settlement.tx.txHash)} target="_blank" rel="noreferrer">{short(settlement.tx.txHash)} ↗</a>
                    : <span className="mono">verified</span>}
                </td>
              </tr>
              <tr><td>Nullifier</td><td className="mono">{short(settlement.bundle.nullifier.toString())}</td></tr>
              <tr><td>View-key commitment</td><td className="mono">{short(settlement.bundle.viewKeyCommitment.toString())}</td></tr>
              <tr><td>Disclosed ciphertext</td><td className="mono">{short(settlement.bundle.disclosedValue[0]!.toString())}</td></tr>
              <tr><td>Sanctions (ASP)</td><td><span className="pill pill--ok">clean ✓</span></td></tr>
              <tr><td>Proof</td><td><span className="pill pill--ok">verified on-chain ✓</span></td></tr>
              <tr><td>Amount</td><td><span className="pill pill--sealed">🔒 sealed</span></td></tr>
              <tr><td>Counterparty</td><td><span className="pill pill--sealed">🔒 sealed</span></td></tr>
            </tbody>
          </table>
          <p className="muted">A regulator holding the view key can verify the sealed fields (see the <strong>Auditor</strong> view). Nobody else can — yet anyone can confirm the transfer is valid and sanctions-clean.</p>
        </div>
      )}
    </div>
  );
}
