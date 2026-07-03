# RUNBOOK — run Aperture locally (and reproduce the on-chain demo)

Every command below was run from a clean state and verified to work. The demo's
proof path is **real**: it generates a real Groth16 proof, verifies it in a deployed
Soroban contract on **Stellar testnet**, and decrypts the disclosed amount with a
view key. Nothing on the proof path is mocked.

> Times: the one-time circuit setup takes **~3–4 min** (trusted setup over 2^15
> powers of tau). Everything else is seconds.

---

## 1. Prerequisites

| Tool | Version used | Check | Install |
|------|--------------|-------|---------|
| Node.js | 24.13 (≥ 20) | `node --version` | nodejs.org / nvm |
| Rust + Cargo | 1.96 | `cargo --version` | rustup.rs |
| wasm target | `wasm32v1-none` | `rustup target list --installed \| grep wasm32v1-none` | `rustup target add wasm32v1-none` |
| circom | 2.2.3 | `circom --version` | `git clone https://github.com/iden3/circom && cd circom && cargo install --path circom` |
| snarkjs | 0.7.6 | `snarkjs --version` | `npm install -g snarkjs` |
| stellar CLI | 27.0.0 | `stellar --version` | `cargo install --locked stellar-cli` |

All commands assume `~/.cargo/bin` and your npm global bin are on `PATH`.

---

## 2. One-time setup (from the repo root)

```bash
# a) install JS deps for the SDK, app, and contract bindings (npm workspaces)
npm install

# b) install deps for the circuits harness (NOT a workspace — install separately)
cd circuits && npm install && cd ..

# c) compile the circuit + run the (demo) trusted setup + generate a proof.
#    Self-contained: compiles disclosure.circom, runs powers-of-tau + groth16 setup,
#    builds a witness, and proves. ~3–4 min.
bash circuits/disclosure/setup_prove.sh
#    -> generates in circuits/disclosure/build/:
#         disclosure_js/disclosure.wasm   (witness generator, ~3.4 MB)
#         disclosure_final.zkey           (proving key, ~8.7 MB)
#         verification_key.json           (verifying key)
#       and proof.json / public.json (a sample proof; ends with "DONE")

# d) copy the runtime artifacts into the app so the browser can fetch them
cd app && npm run artifacts && cd ..
#    -> copies disclosure.wasm + disclosure_final.zkey + verification_key.json
#       into app/public/circuits/
```

> The trusted setup is a **local demo ceremony**, not production. The verifier
> contract is generic (the verification key is passed per call), so regenerating the
> setup is self-consistent — no redeploy needed.

---

## 3. Configure `app/.env.local` (throwaway testnet key — demo only)

The app submits a real verification transaction, so it needs a **funded testnet**
account to sign with. `verify_proof` has no auth, so **any** funded testnet key works.
`app/.env.local` is gitignored — create it:

```bash
# generate + fund a throwaway testnet identity, then read its secret
stellar keys generate aperture-demo --network testnet --fund
stellar keys show aperture-demo        # prints the S... secret

cat > app/.env.local <<EOF
VITE_VERIFIER_CONTRACT_ID=CDKEZLTZNN24BTU5OISHIZ4QNTUANA52G3JMHRM74VJH6KOQKAV74WXK
VITE_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_DEPLOYER_SECRET=<paste the S... secret from 'stellar keys show aperture-demo'>
EOF
```

> ⚠️ The secret is a **throwaway testnet key with no real value**, inlined into the
> client bundle ONLY so the demo can submit a verification tx without a wallet. Never
> do this with a real key. Production would use Freighter or a relayer.

To re-fund an existing address later: `curl "https://friendbot.stellar.org/?addr=<G...>"`.

---

## 4. Run

```bash
cd app && npm run dev
```

Open **http://localhost:5173**. The default view is **Live Demo** (the single-screen
hero); the sidebar also has the four persona views.

---

## 5. Manual verification checklist (maps to the demo)

Using the persona views (Institution → Counterparty → Auditor → Public Explorer):

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | **Institution** → *Generate proof & settle on testnet* | "Proving in your browser…" → "Verifying on testnet…" → green **✓ Verified on-chain** strip with a tx hash (~10–20 s) |
| 2 | Click the tx link | **stellar.expert** loads the **real transaction** on testnet |
| 3 | **Counterparty** | Shows **1,250,000 USDC** received; public sees only a commitment |
| 4 | **Auditor** → type a wrong key → *Reveal & reconcile* | Amount stays `●●●●●●●●`; red **"Wrong view key — never fooled."** |
| 5 | **Auditor** → click *auditor's key* → *Reveal & reconcile* | **1,250,000 USDC** materializes + green **"✓ Recomputed value matches the amount the on-chain proof committed to (tx …)."** |
| 6 | **Public Explorer** | Table shows tx link, nullifier, ciphertext, **ASP clean ✓**, **verified on-chain ✓**, and **Amount 🔒 sealed / Counterparty 🔒 sealed** (2 sealed fields) |

The single-screen **Live Demo** shows the authorized flow and a **sanctioned actor**
side by side: *Attempt disclosure* → **REJECTED ✗** (a sanctioned address cannot even
produce a proof).

**Optional automated check** (needs Playwright + Chromium): with the app served on a
port, `node app/e2e-browser.mjs` (hero) or `node app/personas-browser.mjs` (persona
walkthrough) drive the real flow headlessly and assert the results.

---

## 6. Common failure modes + fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Proving hangs / 404 for `disclosure.wasm` or `.zkey` | Artifacts not copied into the app | Re-run `cd app && npm run artifacts`; confirm `app/public/circuits/` has the 3 files |
| `setup_prove.sh`: `ENOENT … build/input.json` | Running an old script that doesn't compile first | Use the current script (it compiles + `mkdir -p build` itself); re-run from repo root |
| `circom: command not found` (during setup) | circom not on `PATH` | Install circom (§1); ensure `~/.cargo/bin` on `PATH` |
| On-chain verify errors / "tx failed" | Signing key not funded, or RPC/testnet hiccup | Fund the key: `curl "https://friendbot.stellar.org/?addr=<G...>"`; retry; check `https://soroban-testnet.stellar.org` is reachable |
| `verify_proof` returns **false** for a correct settlement | App's `verification_key.json` doesn't match the `zkey` used to prove | Re-run `setup_prove.sh` **then** `npm run artifacts` so vk and zkey come from the same setup |
| `Port 5173 is in use` | Another dev server running | `npm run dev -- --port 5174`, or kill the other process |
| Blank page / `Buffer is not defined` | Stale build without polyfills | `rm -rf app/dist app/node_modules/.vite && npm run dev` |
| `circomlibjs`/`snarkjs` not found during setup | Skipped `cd circuits && npm install` | Run it (§2b) |

---

## 7. What's real vs demo-grade

- **Real:** the proof, the on-chain verification (deployed Soroban contract on
  testnet), the auditor decrypt, the sanctioned-actor rejection.
- **Demo-grade:** local trusted setup; BN254 (~100-bit) with
  BLS12-381 as the identical-logic upgrade; pool/ASP tree depth 10 (a circuit
  parameter); the throwaway signing key.
