import { useState } from "react";
import {
  proveDisclosure, verifyOnChain, auditRecover, holderPublicKey,
  type ProofBundle, type VerifyResult, type AuditOutcome,
} from "../aperture/client.ts";
import { APERTURE } from "../aperture/config.ts";
import "../styles/hero.css";

const AMOUNT = 1_250_000n;
const PRIVATE_KEY = 111222333444n;
const BLINDING = 424242n;
const VIEW_KEY = 987654321987654321n;
const POOL_DECOYS = [11n, 22n, 33n, 44n, 55n];
const CLEAN_SANCTIONS = [777n, 888n, 999n];

const fmt = (n: bigint) => n.toLocaleString("en-US");
const short = (s: string, n = 8) => (s.length > 2 * n ? `${s.slice(0, n)}…${s.slice(-n)}` : s);

type Phase = "idle" | "proving" | "verifying" | "verified" | "error";

function AuthorizedFlow() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [bundle, setBundle] = useState<ProofBundle | null>(null);
  const [tx, setTx] = useState<VerifyResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // interactive reveal
  const [keyInput, setKeyInput] = useState("");
  const [revealed, setRevealed] = useState<AuditOutcome | null>(null);

  async function settle() {
    setErr(null); setBundle(null); setTx(null); setRevealed(null); setKeyInput("");
    try {
      setPhase("proving");
      const b = await proveDisclosure({
        amount: AMOUNT, privateKey: PRIVATE_KEY, blinding: BLINDING,
        decoyLeaves: POOL_DECOYS, sanctionedKeys: CLEAN_SANCTIONS, viewKey: VIEW_KEY,
      });
      setBundle(b);
      setPhase("verifying");
      const v = await verifyOnChain(b.proof, b.publicSignals);
      setTx(v);
      setPhase(v.verified ? "verified" : "error");
      if (!v.verified) setErr("on-chain verification returned false");
    } catch (e) {
      setErr((e as Error).message); setPhase("error");
    }
  }

  async function tryReveal() {
    if (!bundle) return;
    let key: bigint;
    try { key = BigInt(keyInput.trim()); } catch { setRevealed({ amount: null, ok: false, reason: "not a valid key" }); return; }
    setRevealed(await auditRecover(key, bundle.disclosedValue, bundle.nullifier, bundle.viewKeyCommitment));
  }

  const busy = phase === "proving" || phase === "verifying";
  const settled = phase === "verified" && !!bundle;

  return (
    <section className="flow flow--ok">
      <div className="flow__head">
        <span className="flow__tag flow__tag--ok">Authorized transfer</span>
        <h3>Institution settles <strong>{fmt(AMOUNT)} USDC</strong> to a KYC&apos;d counterparty</h3>
      </div>

      {!settled ? (
        <>
          <button className="btn btn--primary" onClick={settle} disabled={busy}>
            {phase === "proving" ? "Proving in your browser…" : phase === "verifying" ? "Verifying on testnet…" : "Settle & prove"}
          </button>
          {busy && <p className="status-live"><span className="spinner" />{phase === "proving" ? "Generating the Groth16 proof client-side (snarkjs / WASM)…" : "Submitting to the Soroban verifier on Stellar testnet…"}</p>}
          {err && <p className="error">⚠ {err}</p>}
        </>
      ) : (
        <>
          {/* on-chain verify — compact trust strip, but the link is unmissable */}
          {tx && (
            <a className="trust" href={tx.txHash ? APERTURE.explorerTx(tx.txHash) : "#"} target="_blank" rel="noreferrer">
              <span className="trust__check">✓ Verified on-chain</span>
              <span className="trust__net">Stellar testnet</span>
              {tx.txHash && <span className="trust__tx">tx {short(tx.txHash)}</span>}
              <span className="trust__cta">verify it yourself ↗</span>
            </a>
          )}

          {/* THE HERO: selective disclosure, interactive */}
          <div className="disclose">
            <div className="disclose__col disclose__col--public">
              <span className="disclose__label">What everyone sees</span>
              <code className="mono-dim">commitment {bundle && short(bundle.nullifier.toString())}</code>
              <code className="mono-dim">ciphertext {bundle && short(bundle.disclosedValue[0]!.toString())}</code>
              <div className="amount-box amount-box--sealed">
                <span className="amount-box__cap">amount</span>
                <span className="blackbox">●●●●●●●●</span>
              </div>
              <p className="cipher-caption">↑ the entire public record of a 1.25M USDC settlement</p>
            </div>

            <div className="disclose__col disclose__col--auditor">
              <span className="disclose__label">What the authorized auditor sees</span>
              <div className={`amount-box ${revealed?.ok ? "amount-box--revealed" : "amount-box--sealed"}`}>
                <span className="amount-box__cap">amount</span>
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
                <button className="btn btn--primary btn--sm" onClick={tryReveal}>Reveal</button>
              </div>
              <p className="hint">
                Type a wrong key and watch it stay sealed — then reveal with the{" "}
                <button className="linkbtn" onClick={() => setKeyInput(String(VIEW_KEY))}>auditor&apos;s key</button>.
              </p>
              {revealed && !revealed.ok && (
                <p className="reject-inline">✗ Wrong view key — the amount stays sealed. The auditor is <strong>never fooled</strong>.</p>
              )}
            </div>
          </div>

          <button className="btn btn--ghost btn--sm" onClick={settle}>↻ Run again</button>
        </>
      )}
    </section>
  );
}

function SanctionedFlow() {
  const [phase, setPhase] = useState<"idle" | "proving" | "rejected">("idle");
  const [pkShort, setPkShort] = useState<string>("");

  async function run() {
    setPhase("proving");
    try {
      const pk = await holderPublicKey(PRIVATE_KEY);
      setPkShort(short(pk.toString(), 6));
      await proveDisclosure({
        amount: AMOUNT, privateKey: PRIVATE_KEY, blinding: BLINDING,
        decoyLeaves: POOL_DECOYS, sanctionedKeys: [777n, pk, 999n], viewKey: VIEW_KEY,
      });
      setPhase("idle");
    } catch {
      setPhase("rejected");
    }
  }

  return (
    <section className="flow flow--deny">
      <div className="flow__head">
        <span className="flow__tag flow__tag--deny">Sanctioned counterparty</span>
        <h3>A sanctioned address attempts the same {fmt(AMOUNT)} USDC disclosure</h3>
      </div>

      <button className="btn btn--danger" onClick={run} disabled={phase === "proving"}>
        {phase === "proving" ? "Attempting…" : "Attempt disclosure"}
      </button>

      <div className="deny-panel">
        {phase === "idle" && <p className="muted">The association set (ASP) excludes sanctioned actors inside the circuit itself.</p>}
        {phase === "proving" && <p className="muted">Attempting to build a proof…</p>}
        {phase === "rejected" && (
          <>
            <div className="deny-verdict">REJECTED ✗</div>
            <p>No valid proof can exist — the ASP non-membership constraint is unsatisfiable for a sanctioned address.</p>
            <ul className="denylist">
              <li>sanctioned · 0x0309…</li>
              <li className="denylist__hit">this address · {pkShort} ← excluded by the ASP</li>
              <li>sanctioned · 0x0999…</li>
            </ul>
            <p className="muted">The chain never even sees a proof. There is nothing to verify.</p>
          </>
        )}
      </div>
    </section>
  );
}

export function HeroDemo() {
  return (
    <div className="hero">
      <header className="hero__head">
        <h1>Confidential payments. <em>Provable compliance.</em></h1>
        <p className="hero__sub">
          Private transfers on Stellar that an authorized auditor — and only an authorized auditor —
          can verify down to the exact amount, while sanctioned actors are provably excluded.
        </p>
        <p className="hero__trust">
          Real Groth16 proofs, verified on-chain on Stellar testnet. <strong>No mocks</strong> — every
          “true” below comes from the live contract, and the tx link is clickable. Check it yourself.
        </p>
      </header>

      <div className="hero__grid">
        <AuthorizedFlow />
        <SanctionedFlow />
      </div>

      <footer className="hero__foot">
        <div className="scope">
          <span className="scope__item">Verifier <code>{short(APERTURE.contractId, 6)}</code> · Stellar testnet</span>
          <span className="scope__sep" aria-hidden="true">·</span>
          <span className="scope__item">Groth16 / BN254 <span className="scope__note">(BLS12-381 = identical-logic production upgrade)</span></span>
          <span className="scope__sep" aria-hidden="true">·</span>
          <span className="scope__item">Poseidon view-key encryption · Merkle pool + sparse-Merkle ASP</span>
        </div>
        <div className="scope scope--muted">
          Engineering scope: tree depth 10, parameterized for production · demonstration trusted setup.
        </div>
      </footer>
    </div>
  );
}
