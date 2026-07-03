// Per-constraint matched-pair tests (1–5): each in-circuit computation is shown
// to agree with the off-chain circomlibjs scheme. Single Poseidon-v1 family.
import { describe, it, expect, beforeAll } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { accepts } from "./util.mjs";
import * as s from "./scheme.mjs";

const D = dirname(fileURLToPath(import.meta.url));
const wasm = (n) => join(D, `circuits/${n}_js/${n}.wasm`);

describe("constraints 1,2,5 — keypair / commitment / signature / nullifier", () => {
  let priv = 111222333n, amount = 1250000n, blinding = 424242n, merklePath = 5n;
  let pk, cm, sig, nf;
  beforeAll(async () => {
    pk = await s.publicKey(priv);
    cm = await s.commitment(amount, pk, blinding);
    sig = await s.signature(priv, cm, merklePath);
    nf = await s.nullifier(cm, merklePath, sig);
  });

  it("in-circuit values agree with circomlibjs", async () => {
    expect(await accepts(wasm("primitives"), {
      privateKey: priv, amount, blinding, merklePath,
      expectedPk: pk, expectedCm: cm, expectedSig: sig, expectedNf: nf,
    })).toBe(true);
  });

  it("rejects a wrong nullifier (binding holds)", async () => {
    expect(await accepts(wasm("primitives"), {
      privateKey: priv, amount, blinding, merklePath,
      expectedPk: pk, expectedCm: cm, expectedSig: sig, expectedNf: nf + 1n,
    })).toBe(false);
  });
});

describe("constraint 3 — pool Merkle membership", () => {
  const levels = 10;
  let leaf, pathElements, pathIndices, root;
  beforeAll(async () => {
    leaf = await s.commitment(7n, await s.publicKey(1n), 9n);
    const leaves = [11n, 22n, 33n, leaf, 55n, 66n];
    const { root: r, layers } = await s.buildMerkle(leaves, levels);
    root = r;
    ({ pathElements, pathIndices } = s.merkleProof(layers, 3, levels)); // leaf at index 3
  });

  it("in-circuit root agrees with circomlibjs-built root", async () => {
    expect(await accepts(wasm("membership"), { leaf, pathElements, pathIndices, expectedRoot: root })).toBe(true);
  });

  it("rejects a wrong root / tampered sibling", async () => {
    const bad = [...pathElements]; bad[0] = bad[0] + 1n;
    expect(await accepts(wasm("membership"), { leaf, pathElements: bad, pathIndices, expectedRoot: root })).toBe(false);
  });
});

describe("constraint 4 — ASP SMT non-membership", () => {
  const n = 10;
  let tree, sanctioned = [777n, 888n, 999n];
  beforeAll(async () => { tree = await s.buildSanctionedSMT(sanctioned); });

  it("accepts a non-member (clean address)", async () => {
    const w = await s.nonMembershipProof(tree, 12345n, n);
    expect(await accepts(wasm("nonmembership"), {
      root: w.root, siblings: w.siblings, oldKey: w.oldKey, oldValue: w.oldValue, isOld0: w.isOld0, key: w.key,
    })).toBe(true);
  });

  it("REJECTS a sanctioned member (non-membership proof must fail for 777)", async () => {
    // For a member, find() returns found=true; we forge a non-membership-shaped
    // input claiming it's absent. The circuit must reject it.
    const member = 777n;
    const res = await tree.find(member);
    expect(res.found).toBe(true);
    const F = tree.F;
    const siblings = res.siblings.map((x) => F.toObject(x));
    while (siblings.length < n) siblings.push(0n);
    const accepted = await accepts(wasm("nonmembership"), {
      root: F.toObject(tree.root), siblings, oldKey: member, oldValue: 0n, isOld0: 0n, key: member,
    });
    expect(accepted).toBe(false);
  });

  it("rejects a tampered sibling", async () => {
    const w = await s.nonMembershipProof(tree, 54321n, n);
    const bad = [...w.siblings]; bad[0] = bad[0] + 1n;
    expect(await accepts(wasm("nonmembership"), {
      root: w.root, siblings: bad, oldKey: w.oldKey, oldValue: w.oldValue, isOld0: w.isOld0, key: w.key,
    })).toBe(false);
  });
});
