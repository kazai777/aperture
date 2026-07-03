// Browser-safe witness construction for the disclosure circuit. Pure scheme math
// (circomlibjs + @zk-kit) — no Node builtins, no snarkjs. The browser builds the
// witness here, then calls snarkjs.groth16.fullProve(input, wasmUrl, zkeyUrl).
import { DisclosureScheme, type Field } from "./poseidon.js";

export interface DisclosureRequest {
  amount: Field;
  privateKey: Field;
  blinding: Field;
  /** Other commitments already in the pool (the holder's is appended). */
  decoyLeaves: Field[];
  /** Sanctioned public keys held in the ASP SMT. */
  sanctionedKeys: Field[];
  /** Symmetric view key shared with the authorized auditor. */
  viewKey: Field;
  levels?: number;
  smtLevels?: number;
}

export interface BuiltWitness {
  /** circom input object (field names match disclosure.circom signals). */
  input: Record<string, unknown>;
  poolRoot: Field;
  aspRoot: Field;
  nullifier: Field;
  viewKeyCommitment: Field;
  disclosedValue: Field[];
}

/**
 * Build the full circom witness from a high-level request.
 * Throws if the holder's public key is sanctioned (no non-membership proof exists)
 * — i.e. a sanctioned actor literally cannot construct a valid witness.
 */
export async function buildDisclosureWitness(
  scheme: DisclosureScheme,
  req: DisclosureRequest,
): Promise<BuiltWitness> {
  const levels = req.levels ?? 10;
  const smtLevels = req.smtLevels ?? 10;

  const pk = scheme.publicKey(req.privateKey);
  const cm = scheme.commitment(req.amount, pk, req.blinding);

  const leaves = [...req.decoyLeaves, cm];
  const leafIndex = req.decoyLeaves.length;
  const { root: poolRoot, layers } = await scheme.buildMerkle(leaves, levels);
  const { pathElements, pathIndices } = scheme.merkleProof(layers, leafIndex, levels);

  const sig = scheme.signature(req.privateKey, cm, pathIndices);
  const nf = scheme.nullifier(cm, pathIndices, sig);
  const nonce = scheme.nonceFromNullifier(nf);

  const tree = await scheme.buildSanctionedSMT(req.sanctionedKeys);
  const asp = await scheme.nonMembershipProof(tree, pk, smtLevels);

  const K0 = scheme.deriveK0(req.viewKey);
  const K1 = scheme.deriveK1(req.viewKey);
  const vkc = scheme.viewKeyCommitment(req.viewKey);
  const disclosedValue = scheme.encryptAmount(req.amount, K0, K1, nonce);

  const input: Record<string, unknown> = {
    poolRoot, aspRoot: asp.root, nullifier: nf, viewKeyCommitment: vkc, disclosedValue,
    amount: req.amount, privateKey: req.privateKey, blinding: req.blinding,
    merklePath: pathIndices, pathElements,
    aspSiblings: asp.siblings, aspOldKey: asp.oldKey, aspOldValue: asp.oldValue, aspIsOld0: asp.isOld0,
    viewKey: req.viewKey,
  };
  return { input, poolRoot, aspRoot: asp.root, nullifier: nf, viewKeyCommitment: vkc, disclosedValue };
}
