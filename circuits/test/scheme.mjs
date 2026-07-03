// Off-chain matcher for the Aperture disclosure scheme.
//
// SINGLE HASH FAMILY: all application hashing (keypair, commitment, signature,
// nullifier, Merkle node, key-derivation, viewKeyCommitment, SMT) is circomlib
// Poseidon v1, via circomlibjs — the matched off-chain pair of circomlib's
// poseidon.circom / smtverifier.circom. No Poseidon2 anywhere.
//
// The disclosure cipher is the separate Poseidon-encryption AEAD primitive
// (@zk-kit/poseidon-cipher <-> isolated weijiekoh circom), used only to
// encrypt/decrypt the amount. Its internal constants are encapsulated in the
// cipher; they are not an application hash.

import { buildPoseidon, newMemEmptyTrie } from "circomlibjs";
import { poseidonEncrypt, poseidonDecrypt } from "@zk-kit/poseidon-cipher";

let _poseidon;
export async function getPoseidon() {
  if (!_poseidon) _poseidon = await buildPoseidon();
  return _poseidon;
}

/** Poseidon hash of field elements -> bigint (matches circomlib Poseidon(n) in-circuit). */
export async function H(inputs) {
  const p = await getPoseidon();
  return p.F.toObject(p(inputs.map((x) => BigInt(x))));
}

// ---- application scheme (same shapes as SPP, built on Poseidon v1) ----
export const publicKey = (sk) => H([sk]);                       // (1) keypair
export const commitment = (amount, pk, blinding) => H([amount, pk, blinding]); // (2)
export const signature = (sk, cm, merklePath) => H([sk, cm, merklePath]);      // (5a)
export const nullifier = (cm, merklePath, sig) => H([cm, merklePath, sig]);     // (5b)

/** nonce = low 128 bits of the nullifier (cipher requires nonce < 2^128). */
export const nonceFromNullifier = (nf) => BigInt(nf) & ((1n << 128n) - 1n);

// ---- disclosure-layer key derivation (same family, domain tags 5/6/7) ----
export const deriveK0 = (vk) => H([vk, 5]);
export const deriveK1 = (vk) => H([vk, 6]);
export const viewKeyCommitment = (vk) => H([vk, 7]);

// ---- binary Merkle tree (node = Poseidon([left,right])), pool membership (3) ----
export async function buildMerkle(leaves, levels) {
  const size = 2 ** levels;
  let layer = leaves.map(BigInt);
  while (layer.length < size) layer.push(0n);
  const layers = [layer];
  for (let l = 0; l < levels; l++) {
    const cur = layers[l];
    const next = [];
    for (let i = 0; i < cur.length; i += 2) next.push(await H([cur[i], cur[i + 1]]));
    layers.push(next);
  }
  return { root: layers[levels][0], layers };
}

/** Merkle path for `index`: sibling elements + packed pathIndices bitfield. */
export function merkleProof(layers, index, levels) {
  const pathElements = [];
  let idx = index;
  let pathIndices = 0n;
  for (let l = 0; l < levels; l++) {
    pathElements.push(layers[l][idx ^ 1]);
    if (idx & 1) pathIndices |= 1n << BigInt(l);
    idx >>= 1;
  }
  return { pathElements, pathIndices };
}

// ---- ASP sparse-Merkle-tree non-membership (4) via circomlibjs (matched to
// circomlib smtverifier.circom) ----
export async function buildSanctionedSMT(sanctionedKeys) {
  const tree = await newMemEmptyTrie();
  for (const k of sanctionedKeys) await tree.insert(BigInt(k), 0n);
  return tree;
}

/** Non-membership witness for `key`, padded to `nLevels` siblings. */
export async function nonMembershipProof(tree, key, nLevels) {
  const F = tree.F;
  const res = await tree.find(BigInt(key));
  if (res.found) throw new Error(`key ${key} IS in the sanctioned set (membership, not non-membership)`);
  const siblings = res.siblings.map((s) => F.toObject(s));
  while (siblings.length < nLevels) siblings.push(0n);
  return {
    root: F.toObject(tree.root),
    siblings,
    oldKey: res.isOld0 ? 0n : F.toObject(res.notFoundKey),
    oldValue: res.isOld0 ? 0n : F.toObject(res.notFoundValue),
    isOld0: res.isOld0 ? 1n : 0n,
    key: BigInt(key),
  };
}

// ---- disclosure cipher (off-circuit prover encrypt + auditor decrypt) ----
export function encryptAmount(amount, K0, K1, nonce) {
  return poseidonEncrypt([BigInt(amount)], [BigInt(K0), BigInt(K1)], BigInt(nonce));
}
export function decryptAmount(ciphertext, K0, K1, nonce) {
  return poseidonDecrypt(ciphertext.map(BigInt), [BigInt(K0), BigInt(K1)], BigInt(nonce), 1);
}
