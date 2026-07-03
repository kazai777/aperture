// Aperture disclosure scheme (Poseidon v1, single family), TypeScript.
// The off-chain counterpart of the circuit: circomlibjs for the application hashes
// (keypair, commitment, nullifier, Merkle, SMT, key derivation) and
// @zk-kit/poseidon-cipher for the disclosure encryption. Every value matches what
// the circuit constrains in-circuit.

import { buildPoseidon, newMemEmptyTrie } from "circomlibjs";
import { poseidonEncrypt, poseidonDecrypt } from "@zk-kit/poseidon-cipher";

export type Field = bigint;

export interface PoolWitness {
  pathElements: Field[];
  pathIndices: Field;
}
export interface AspWitness {
  root: Field;
  siblings: Field[];
  oldKey: Field;
  oldValue: Field;
  isOld0: Field;
}

export class DisclosureScheme {
  private constructor(private readonly poseidon: any) {}

  static async create(): Promise<DisclosureScheme> {
    return new DisclosureScheme(await buildPoseidon());
  }

  /** Poseidon hash -> bigint (matches circomlib Poseidon(n) in-circuit). */
  H(inputs: (Field | number)[]): Field {
    const p = this.poseidon;
    return p.F.toObject(p(inputs.map((x) => BigInt(x)))) as bigint;
  }

  // ---- base scheme (SPP constructions on Poseidon v1) ----
  publicKey(sk: Field): Field {
    return this.H([sk]);
  }
  commitment(amount: Field, pk: Field, blinding: Field): Field {
    return this.H([amount, pk, blinding]);
  }
  signature(sk: Field, cm: Field, merklePath: Field): Field {
    return this.H([sk, cm, merklePath]);
  }
  nullifier(cm: Field, merklePath: Field, sig: Field): Field {
    return this.H([cm, merklePath, sig]);
  }

  /** nonce = low 128 bits of the nullifier (cipher requires nonce < 2^128). */
  nonceFromNullifier(nf: Field): Field {
    return nf & ((1n << 128n) - 1n);
  }

  // ---- disclosure-layer key derivation (tags 5/6/7) ----
  deriveK0(vk: Field): Field {
    return this.H([vk, 5]);
  }
  deriveK1(vk: Field): Field {
    return this.H([vk, 6]);
  }
  viewKeyCommitment(vk: Field): Field {
    return this.H([vk, 7]);
  }

  // ---- pool binary Merkle tree (node = Poseidon([l,r])) ----
  async buildMerkle(leaves: Field[], levels: number): Promise<{ root: Field; layers: Field[][] }> {
    const size = 2 ** levels;
    let layer = leaves.map(BigInt);
    while (layer.length < size) layer.push(0n);
    const layers: Field[][] = [layer];
    for (let l = 0; l < levels; l++) {
      const cur = layers[l]!;
      const next: Field[] = [];
      for (let i = 0; i < cur.length; i += 2) next.push(this.H([cur[i]!, cur[i + 1]!]));
      layers.push(next);
    }
    return { root: layers[levels]![0]!, layers };
  }

  merkleProof(layers: Field[][], index: number, levels: number): PoolWitness {
    const pathElements: Field[] = [];
    let idx = index;
    let pathIndices = 0n;
    for (let l = 0; l < levels; l++) {
      pathElements.push(layers[l]![idx ^ 1]!);
      if (idx & 1) pathIndices |= 1n << BigInt(l);
      idx >>= 1;
    }
    return { pathElements, pathIndices };
  }

  // ---- ASP sanctioned-set SMT (matched to circomlib smtverifier) ----
  async buildSanctionedSMT(keys: Field[]): Promise<any> {
    const tree = await newMemEmptyTrie();
    for (const k of keys) await tree.insert(BigInt(k), 0n);
    return tree;
  }

  async nonMembershipProof(tree: any, key: Field, nLevels: number): Promise<AspWitness> {
    const F = tree.F;
    const res = await tree.find(BigInt(key));
    if (res.found) throw new Error(`key ${key} IS sanctioned — no non-membership proof exists`);
    const siblings: Field[] = res.siblings.map((s: unknown) => F.toObject(s) as bigint);
    while (siblings.length < nLevels) siblings.push(0n);
    return {
      root: F.toObject(tree.root),
      siblings,
      oldKey: res.isOld0 ? 0n : F.toObject(res.notFoundKey),
      oldValue: res.isOld0 ? 0n : F.toObject(res.notFoundValue),
      isOld0: res.isOld0 ? 1n : 0n,
    };
  }

  async isSanctioned(tree: any, key: Field): Promise<boolean> {
    return (await tree.find(BigInt(key))).found;
  }

  // ---- disclosure cipher ----
  encryptAmount(amount: Field, K0: Field, K1: Field, nonce: Field): Field[] {
    return poseidonEncrypt([amount], [K0, K1], nonce);
  }
  /** Auditor side: recover the amount; throws if the auth tag is invalid. */
  decryptAmount(ciphertext: Field[], K0: Field, K1: Field, nonce: Field): Field {
    return poseidonDecrypt(ciphertext.map(BigInt), [K0, K1], nonce, 1)[0]!;
  }
}
