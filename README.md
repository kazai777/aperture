# Aperture

> **Compliant selective disclosure for Stellar.**
> Confidential payments that an authorized auditor can still verify — with sanctioned
> actors provably excluded. A reusable zero-knowledge primitive: circuit + Soroban
> verifier + typed SDK.

Aperture lets an institution settle a transfer on Stellar with the **amount and
counterparty hidden** from the public ledger, while a regulator or auditor holding a
**view key** can cryptographically recover exactly the attribute they're entitled to
see — and a sanctioned actor cannot transact at all. The disclosure logic ships as a
building block any Stellar/Soroban developer can adopt.

*Open by default, private when needed, auditable on demand.*

---

## What it proves

Every settlement carries one zero-knowledge proof establishing three things:

1. **Validity** — the note is well-formed and belongs to the pool (Poseidon
   commitment + Merkle membership).
2. **Compliance** — the owner is **not** in the sanctioned set (association-set
   non-membership; a sanctioned actor cannot produce a valid proof).
3. **Selective disclosure** — a chosen attribute (the amount) is encrypted to a
   **view key**, so only an authorized auditor recovers it, and the value is provably
   the one that was actually settled.

Disclosure soundness rests on a **shared wire**, not on trusting the cipher: the
`amount` feeds both the on-chain commitment and the encrypted disclosure, so a prover
cannot disclose a value different from what was settled. See
[`docs/DISCLOSURE_DESIGN.md`](docs/DISCLOSURE_DESIGN.md) for the construction and the
no-forgery argument.

## Architecture

Three components, each adoptable on its own:

| Component | What it is | Path |
|-----------|-----------|------|
| **Disclosure circuit** | Circom / Groth16 over BN254 — commitment + pool membership + ASP non-membership + view-key disclosure | [`circuits/`](circuits/) |
| **Soroban verifier** | Deployed contract using native BN254 host functions; the verification key is passed per call | [`contracts/`](contracts/), [`packages/verifier-client/`](packages/verifier-client/) |
| **TypeScript SDK** | Typed wrapper for the whole flow: build witness → prove → verify on-chain → audit | [`sdk/`](sdk/) |

The circuit reuses a privacy-pool + association-set substrate and adds the **view-key
disclosure layer** on top.

## Use the SDK

```ts
import { createApertureReal } from "@aperture/sdk/node";

const aperture = await createApertureReal({ artifactDir, contractId, source, network: "testnet" });

const proof = await aperture.prove({ amount, privateKey, blinding, decoyLeaves, sanctionedKeys, viewKey });
const { verified, txHash } = await aperture.verifyOnChain(proof); // Soroban verification on Stellar
const { amount } = aperture.audit(viewKey, proof);                // the auditor recovers the amount
```

`prove → verifyOnChain → audit`. A browser-safe entry (`@aperture/sdk`) exposes the
scheme, witness builder, and auditor for fully client-side apps; the
`@aperture/sdk/node` entry adds the local prover and on-chain verifier.

## Run it locally

Full step-by-step (prerequisites, one-time setup, running the demo app) is in
[`docs/RUNBOOK.md`](docs/RUNBOOK.md). In short:

```bash
npm install
cd circuits && npm install && cd ..
bash circuits/disclosure/setup_prove.sh   # compile + trusted setup + a sample proof
cd app && npm run artifacts && npm run dev # http://localhost:5173
```

The demo app has an institution, a counterparty, an auditor, and a public-explorer
view — one real settlement seen from four roles, verified live on Stellar testnet.

## Project structure

```
circuits/     Circom disclosure circuit, Poseidon libraries, and the test harness
contracts/    Soroban BN254 Groth16 verifier (Rust)
packages/     Generated @stellar/stellar-sdk bindings for the verifier
sdk/          @aperture/sdk — typed prove / verifyOnChain / audit
app/          React demo (client-side proving + on-chain verification)
tools/        proof-encoder — snarkjs → Soroban BN254 CLI args
docs/         Product overview, security design, runbook
```

## What's real, and scope

The full proof path is real: proofs are generated client-side (snarkjs/WASM) and
verified by a deployed Soroban contract on **Stellar testnet** — verifier
`CDKEZLTZNN24BTU5OISHIZ4QNTUANA52G3JMHRM74VJH6KOQKAV74WXK`. Correct proof → `true`,
tampered input → `false`, sanctioned actor → no proof exists.

Deliberate scope, and its production path:

| Current | Production path |
|---------|-----------------|
| BN254 (~100-bit; the curve Ethereum/Tornado/MACI use) | BLS12-381 (~120-bit) — identical circuit logic |
| Local demonstration trusted setup | Multi-party ceremony |
| Pool / ASP tree depth 10 (a circuit parameter) | Higher depth + re-run setup |
| Symmetric view key | Asymmetric view keys (Baby Jubjub ECDH) |

[`docs/DISCLOSURE_DESIGN.md`](docs/DISCLOSURE_DESIGN.md) (security argument) ·
[`docs/RUNBOOK.md`](docs/RUNBOOK.md) (run it).

## License

MIT — see [`LICENSE`](LICENSE).
