# View-key selective disclosure — design & security argument

> §4 is the no-forgery argument. Implementation note: the base scheme is a single
> Poseidon v1 family; the domain tags `0x0N` below are realized as trailing Poseidon
> input constants `N`, and the nonce is `low128(nullifier)` (the cipher requires
> `nonce < 2^128`). The security argument is unchanged by these specifics.

## 0. TL;DR

- **Decision:** disclose the attribute by **encrypting it to a symmetric view key
  using Poseidon (DuplexSponge / Khovratovich "Encryption with Poseidon")**, with
  the **nullifier as the per-disclosure nonce**, and bind the auditor via
  `viewKeyCommitment = Poseidon v1(viewKey)`. The circuit proves the ciphertext
  encrypts the *same* `amount` wire that is committed in the pool note.
- **Why it's sound:** `amount` is one wire feeding both the pool commitment (pinned
  on-chain) and the ciphertext, so the ciphertext cannot encode anything other than
  the truly-committed amount. See §4.
- **Confidence:** HIGH on soundness, MEDIUM-HIGH on the privacy (PRF) assumption.
  Residual risks in §6, all disclosed and bounded.

---

## 1. What we are building

A verifiable, **per-note, per-attribute** selective disclosure: an authorized
auditor holding a view key can recover *one* disclosed attribute (the settled
`amount`, or a predicate like "amount ≤ mandate") of *one* note, and is
cryptographically assured the value is faithful to what was actually settled —
while the public learns nothing beyond "a valid, ASP-clean disclosure occurred."

This is **finer-grained than a Zcash/Railgun master viewing key**, which decrypts
*all* of a user's activity. ([Railgun docs](https://docs.railgun.org/wiki/learn/wallets-and-keys):
a viewing key "lets a trusted third party decrypt and verify all transactions.")
Aperture discloses exactly one attribute of one note — the compliance-grade primitive.

## 2. The construction

Notation: `F` = BN254 scalar field. `P(x; t)` = circomlib **Poseidon v1** of inputs
`x`, domain-separated by a trailing input constant `t` (e.g. `P(viewKey; 7) =
Poseidon([viewKey, 7])`), matched off-chain by `circomlibjs`. The disclosure-layer
tags are `5/6/7`; base-scheme separation is by input arity/position.

**Witness (private):** `viewKey ∈ F` (the symmetric key the auditor holds), plus
the base-scheme witness (`privateKey, amount, blinding`, Merkle/SMT paths).

**Public inputs added by #6:**
- `viewKeyCommitment = P(viewKey; 0x07)` — binds the disclosure to a specific key.
- `disclosedValue = C` — the ciphertext (see below), a small fixed-length tuple in `F`.

**Encryption (in-circuit), the Poseidon cipher:**
1. Derive a 2-element cipher key from the *same* `viewKey`:
   `K0 = P(viewKey; 0x05)`, `K1 = P(viewKey; 0x06)`.
2. Nonce `η = nullifier` (already a public input; unique per note — see §3).
3. Plaintext `m = [amount]` (one field element; `amount < 2^248`, range-checked
   per SPP). For a predicate disclosure, `m = [f(amount)]` and `f` is additionally
   constrained in-circuit.
4. `C = PoseidonEncrypt(m; K0, K1, η)` — the standard sponge cipher: each plaintext
   element is masked by adding a Poseidon-derived keystream element, with a final
   sponge output appended as an **authentication tag**. For `m` of length 1, `C` is
   a short fixed-length tuple (one masked element + tag).

**In-circuit constraints (the additions):**
- (6a) `viewKeyCommitment == P(viewKey; 0x07)`
- (6b) `K0 == P(viewKey; 0x05)` and `K1 == P(viewKey; 0x06)`
- (6c) `disclosedValue == PoseidonEncrypt([amount]; K0, K1, nullifier)`

`amount` and `nullifier` here are the **same wires** used by the base-scheme
constraints (commitment integrity, pool membership, nullifier correctness).

**Auditor (off-chain), holding `viewKey` — e.g. via `@zk-kit/poseidon-cipher`:**
1. Check `P(viewKey; 0x07) == viewKeyCommitment`. (Confirms they hold the right
   key for *this* disclosure; if not, they reject — they are never fooled.)
2. Derive `K0, K1`; set `η = nullifier`.
3. `amount' = PoseidonDecrypt(C; K0, K1, η)`. Decryption recomputes the keystream
   and **verifies the auth tag** (integrity); subtraction recovers `amount'`.
4. The on-chain Groth16 verification *already* guarantees `C` encrypts the committed
   amount, so `amount' = ` the true settled amount. The equivalence test is exactly
   `amount' == amount_committed`.

## 3. Why the nonce is the nullifier (and why this matters)

The Poseidon cipher is a stream cipher: **a `(key, nonce)` pair must never encrypt
two different plaintexts**, or the keystream cancels and both plaintexts leak
([rubydusa, "Symmetric Encryption in Circom"](https://rubydusa.medium.com/symmetric-encryption-in-circom-53137de2a011)).
MACI can hardcode `nonce = 0` only because each ECDH key is ephemeral and
single-use. **Our view key is long-lived** (one auditor, many disclosures), so the
nonce must be unique per disclosure. The `nullifier` is:
- already public (needed for replay protection),
- collision-resistantly unique per note,

so it is a perfect nonce. Same note → same `(key, nonce)` → identical ciphertext
(harmless: it is the same disclosure, and on-chain nullifier replay-protection
blocks a second one). Different notes or different auditors → different `(key,nonce)`.
**Hard invariant:** never encrypt two *different* plaintexts under the same
`(viewKey, nullifier)`. The "one note, one disclosure" scope guard enforces this;
if we ever disclose multiple attributes of one note, diversify the nonce as
`P(nullifier, attributeId)`.

## 4. Security argument (verify this, don't trust it)

**Threat model.** The prover is the note holder (institution). Verifiers are the
public chain and the auditor. The adversary is a **dishonest holder** who wants
either (a) to make the auditor accept a false amount `â ≠ a` while a *different*
amount `a` is actually committed on-chain for this note, or (b) to leak the amount
to the public. The auditor is trusted to *read* but not assumed to trust the holder.

**Assumptions.** (i) Poseidon v1 is collision-resistant and behaves as a PRF when
keyed by a secret (the standard ZK assumption SPP/MACI/Dusk/Zcash-on-Poseidon all
rely on). (ii) Groth16/BN254 is knowledge-sound under an honest (demo) setup.
(iii) The Poseidon cipher is correct (deterministic enc/dec inverse) and provides
confidentiality+integrity under (i) with unique `(key,nonce)`. (iv) `viewKey` is
secret from the public.

**What a verifying proof certifies.** For public `(poolRoot, aspRoot, nullifier,
viewKeyCommitment, disclosedValue)`, the prover knows `(privateKey, amount,
blinding, paths, viewKey)` such that *simultaneously*:
1. `publicKey = P(privateKey; 0x03)`
2. `commitment = P(amount, publicKey, blinding; 0x01)`
3. `commitment` is a leaf under `poolRoot` (Merkle)
4. `publicKey ∉` sanctioned SMT under `aspRoot`
5. `nullifier = P(commitment, merklePath, sig; 0x02)`, `sig = P(privateKey, commitment, merklePath; 0x04)`
6. `viewKeyCommitment = P(viewKey; 0x07)`; `K = (P(viewKey;0x05), P(viewKey;0x06))`;
   `disclosedValue = PoseidonEncrypt([amount]; K, nullifier)`

The `amount` in (2) and (6) is the **same wire**. Therefore `disclosedValue`
encrypts *exactly* the amount inside the pool-committed note identified by `nullifier`.

**No-forgery.** Suppose the holder wants the auditor to accept `â ≠ a`. The auditor
accepts a value only if both: (i) `P(viewKey_aud; 0x07) == viewKeyCommitment`, and
(ii) `PoseidonDecrypt(disclosedValue; K(viewKey_aud), nullifier) == â` with a valid
tag. For any verifying proof, `disclosedValue = PoseidonEncrypt([a]; K(viewKey*),
nullifier)` where `viewKey*` is the witness and `viewKeyCommitment = P(viewKey*; 0x07)`.

- *Case `viewKey* = viewKey_aud`.* Keys match; by cipher correctness
  `PoseidonDecrypt(disclosedValue) = a` with a valid tag. To get `â ≠ a` the holder
  would need a single ciphertext that the circuit accepts as `Enc([a])` yet decrypts
  to `â` — impossible, the cipher is a deterministic bijection for fixed `(key,nonce)`.
- *Case `viewKey* ≠ viewKey_aud`.* Acceptance needs `P(viewKey_aud;0x07) =
  viewKeyCommitment = P(viewKey*;0x07)` with `viewKey_aud ≠ viewKey*` — a Poseidon v1
  collision, infeasible. So the auditor's key-check fails and they **reject** (they
  detect a foreign/bad key) rather than being fooled.

Hence the auditor either recovers the true `a` or rejects; a dishonest prover can
**never** produce a `disclosedValue` that both verifies on-chain and decrypts, under
the auditor's legitimate key, to anything other than the truly committed amount. ∎

**Right-note binding.** Which note is being disclosed is pinned by the public
`nullifier`: it is collision-resistantly derived from `commitment` (5), and the
audit is scoped to the on-chain transaction bearing that nullifier. So "the disclosed
note" = "the note with this nullifier," whose amount is the unique `a`.

**Revealed vs private.**
- *Public:* `poolRoot, aspRoot, nullifier, viewKeyCommitment, disclosedValue`, and
  "proof verified." They learn only that a valid, ASP-clean note was disclosed to the
  holder of `viewKeyCommitment`. `disclosedValue` masks `amount` with a secret-keyed,
  one-time keystream → indistinguishable from random without `viewKey`.
  `viewKeyCommitment = P(viewKey)` is one-way → leaks nothing about the key or auditor
  identity (beyond linkability of disclosures reusing the same key — see §6).
- *Auditor (holds `viewKey`):* learns exactly `amount` (or only `f(amount)` for a
  predicate) — nothing else about the witness.
- *Holder:* knows everything (own note).

## 5. Alternatives considered and rejected

- **A. Asymmetric ECDH note encryption (Zcash Sapling / MACI style, Baby Jubjub).**
  Gold standard: auditor never shares a secret, gives non-repudiation, allows
  `nonce=0` via ephemeral keys. **Not adopted:** needs in-circuit EC
  scalar multiplication. On BN254 (our curve), circomlib's **Baby Jubjub is
  available** — so this is a *scope* call, not an availability one: it adds EC cost
  and complexity, and **SPP itself deliberately avoids embedded-curve ops**
  (hash-based keypair: *"since we don't use signatures, the keypair can be based on
  a simple hash"*). The only thing it buys — third-party non-repudiation — the demo
  does not need. **Documented as the production upgrade; the BN254 choice
  makes it *easier* (Baby Jubjub + MACI-style ECDH are off-the-shelf on BN254).**
- **B. Commitment-based selective opening** (`disclosedValue` = hiding commitment to
  `amount`, opened off-chain). **Rejected:** requires an out-of-band interactive
  opening and does **not** let the auditor *recover* the value from the view key
  alone; no intrinsic auditor-binding. Weaker DX, doesn't match the "reconstruct from
  view key" thesis.
- **C. Keyed one-way derivation** (`disclosedValue = P(amount, viewKey)`).
  **Rejected as primary:** verify-only — the auditor must already *know* `amount` to
  check it; they cannot recover it (brute-force only, feasible for tiny ranges, leaks
  via guessability). Our construction is the *invertible* form of this (additive
  keystream instead of one-way hash), at the same circuit cost. Kept as a lighter
  "verify a claimed amount" mode if ever needed.

## 6. Confidence and residual risk

**Confidence: HIGH (soundness), MEDIUM-HIGH (privacy).** The no-forgery argument
reduces to Poseidon v1 collision-resistance + Groth16 knowledge-soundness + cipher
correctness — all standard. Confidentiality additionally needs Poseidon-as-PRF.

Residual risks, all bounded and disclosed:
1. **Nonce reuse** would be catastrophic (keystream cancellation). Mitigated by
   `nonce = nullifier` (unique per note) + the one-note-one-disclosure invariant.
   *Must* be re-checked if scope expands to multiple attributes per note.
2. **Symmetric-key limitation:** `viewKey` is shared, so there is no third-party
   non-repudiation (the auditor could have encrypted the value themselves). Acceptable
   — on-chain verification already gives public assurance a faithful disclosure
   exists, and a holder picking a bad key can only cause the auditor to *detect a
   mismatch* (liveness), never to accept a false value (soundness intact). Asymmetric
   upgrade (A) removes this.
3. **Poseidon-as-cipher** is younger than AES, but is the ZK-native standard
   (production in MACI; `@zk-kit/poseidon-cipher`; Dusk) and is what SPP-compatibility
   favors. Clearly a **demo-grade** assumption, stated in the README.
4. **Trusted setup** is a local demo ceremony, not production (already disclosed).

## 7. Reusable implementations to lean on (don't roll our own crypto)

- **In-circuit:** the Poseidon encryption circuit from MACI / `@zk-kit/circuits`
  (`poseidonEncrypt`), adapted to Poseidon v1 + SPP tags. Vendor and review; do not
  hand-write the sponge.
- **Off-chain (auditor + SDK):** [`@zk-kit/poseidon-cipher`](https://www.npmjs.com/package/@zk-kit/poseidon-cipher)
  for `poseidonDecrypt`.

## Sources

- Grassi, Khovratovich, Rechberger, Roy, Schofnegger — *Poseidon: A New Hash Function
  for ZK Proof Systems*, ePrint 2019/458 (DuplexSponge AE mode).
- *Duplexing the Sponge: Single-Pass Authenticated Encryption*, ePrint 2011/499.
- MACI primitives (poseidonEncrypt/Decrypt, ECDH key, nonce=0 rationale):
  https://maci.pse.dev/docs/v1.2/primitives
- `@zk-kit/poseidon-cipher`: https://www.npmjs.com/package/@zk-kit/poseidon-cipher
- rubydusa, *Symmetric Encryption in Circom* (nonce-reuse warning):
  https://rubydusa.medium.com/symmetric-encryption-in-circom-53137de2a011
- Baby Jubjub (BN254 embedded curve, circomlib) — the asymmetric production-upgrade
  path; EIP-2494.
- Railgun viewing keys (master-key contrast): https://docs.railgun.org/wiki/learn/wallets-and-keys
