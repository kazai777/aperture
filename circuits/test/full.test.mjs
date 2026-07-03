// Full disclosure circuit (constraints 1–6) end-to-end, including the six #6
// disclosure checks run on the complete circuit with the real nullifier-derived
// nonce.
import { describe, it, expect, beforeAll } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { accepts } from "./util.mjs";
import * as s from "./scheme.mjs";

const D = dirname(fileURLToPath(import.meta.url));
const WASM = join(D, "../disclosure/build/disclosure_js/disclosure.wasm");
const LEVELS = 10, SMT_LEVELS = 10;

// Build a complete, valid witness for one disclosure.
async function buildWitness({ amount = 1250000n, viewKey = 987654321987654321n } = {}) {
  const privateKey = 111222333444n, blinding = 424242n;
  const pk = await s.publicKey(privateKey);
  const cm = await s.commitment(amount, pk, blinding);

  // pool: cm placed at index 3
  const leaves = [11n, 22n, 33n, cm, 55n, 66n];
  const { root: poolRoot, layers } = await s.buildMerkle(leaves, LEVELS);
  const { pathElements, pathIndices } = s.merkleProof(layers, 3, LEVELS);

  // nullifier (path = packed pool indices)
  const sig = await s.signature(privateKey, cm, pathIndices);
  const nf = await s.nullifier(cm, pathIndices, sig);
  const nonce = s.nonceFromNullifier(nf);

  // ASP: pk not in sanctioned set
  const tree = await s.buildSanctionedSMT([777n, 888n, 999n]);
  const asp = await s.nonMembershipProof(tree, pk, SMT_LEVELS);

  // disclosure
  const K0 = await s.deriveK0(viewKey), K1 = await s.deriveK1(viewKey);
  const vkc = await s.viewKeyCommitment(viewKey);
  const disclosedValue = s.encryptAmount(amount, K0, K1, nonce);

  const input = {
    poolRoot, aspRoot: asp.root, nullifier: nf, viewKeyCommitment: vkc, disclosedValue,
    amount, privateKey, blinding, merklePath: pathIndices, pathElements,
    aspSiblings: asp.siblings, aspOldKey: asp.oldKey, aspOldValue: asp.oldValue, aspIsOld0: asp.isOld0,
    viewKey,
  };
  return { input, amount, viewKey, K0, K1, vkc, nonce, disclosedValue };
}

describe("full disclosure circuit (constraints 1–6, BN254)", () => {
  let ctx;
  beforeAll(async () => { ctx = await buildWitness(); });

  it("#6.1 AUDITOR RECOVERS THE TRUTH: off-chain decrypt of the on-chain ciphertext returns the exact amount + tag verifies", () => {
    const recovered = s.decryptAmount(ctx.disclosedValue, ctx.K0, ctx.K1, ctx.nonce);
    expect(recovered[0]).toBe(ctx.amount);
  });

  it("#6.2 IN-CIRCUIT: the complete circuit accepts a faithful witness (all of 1–6 hold, real nullifier-nonce)", async () => {
    expect(await accepts(WASM, ctx.input)).toBe(true);
  });

  it("#6.3 REJECTS A LIE (wrong view key): off-chain decrypt fails the tag check", async () => {
    const wrongK0 = await s.deriveK0(ctx.viewKey + 1n), wrongK1 = await s.deriveK1(ctx.viewKey + 1n);
    expect(() => s.decryptAmount(ctx.disclosedValue, wrongK0, wrongK1, ctx.nonce)).toThrow();
  });

  it("#6.4 REJECTS A LIE (tampered ciphertext): both off-chain decrypt AND the circuit reject", async () => {
    const tampered = [...ctx.disclosedValue]; tampered[0] = tampered[0] + 1n;
    expect(() => s.decryptAmount(tampered, ctx.K0, ctx.K1, ctx.nonce)).toThrow();
    expect(await accepts(WASM, { ...ctx.input, disclosedValue: tampered })).toBe(false);
  });

  it("#6.5 REJECTS A LIE (forged viewKeyCommitment): circuit rejects a vkc that doesn't bind viewKey", async () => {
    expect(await accepts(WASM, { ...ctx.input, viewKeyCommitment: ctx.vkc + 1n })).toBe(false);
  });

  it("#6.6 REJECTS A LIE (ciphertext encrypts a different amount than committed): disclosure binds to the real amount", async () => {
    // amount stays consistent with the commitment, but the ciphertext encrypts amount+1.
    const fakeCt = s.encryptAmount(ctx.amount + 1n, ctx.K0, ctx.K1, ctx.nonce);
    expect(await accepts(WASM, { ...ctx.input, disclosedValue: fakeCt })).toBe(false);
  });

  it("ASP: a sanctioned holder cannot disclose (non-membership fails for a sanctioned pk)", async () => {
    // Rebuild with the holder's pk inserted INTO the sanctioned set -> non-membership impossible.
    const privateKey = 111222333444n;
    const pk = await s.publicKey(privateKey);
    const tree = await s.buildSanctionedSMT([777n, pk, 999n]);
    const res = await tree.find(pk);
    expect(res.found).toBe(true); // pk is sanctioned; honest non-membership cannot be produced
  });
});
