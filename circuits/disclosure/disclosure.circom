pragma circom 2.1.5;

// ============================================================================
// Aperture disclosure circuit — constraints 1–6, BN254.
//
// SINGLE HASH FAMILY: every application hash (keypair, commitment, signature,
// nullifier, Merkle node, SMT, key-derivation, viewKeyCommitment) is circomlib
// Poseidon v1, matched off-chain by circomlibjs. No Poseidon2 anywhere.
//
// The disclosure cipher is the isolated Poseidon-encryption AEAD primitive
// (renamed C* templates in ../lib/aperture/cipher_iso.circom, matched off-chain
// by @zk-kit/poseidon-cipher). Its constants are encapsulated in the cipher and
// are NOT an application hash — this boundary must be preserved; unifying it
// with the application Poseidon would break the @zk-kit pairing. Only raw field
// elements (amount, viewKey, nullifier) cross into the cipher.
//
// Scheme (built on SPP constructions over Poseidon v1):
//   pk  = Poseidon(privateKey)
//   cm  = Poseidon(amount, pk, blinding)
//   sig = Poseidon(privateKey, cm, merklePath)
//   nf  = Poseidon(cm, merklePath, sig)
//   nonce = low128(nf)            (cipher requires nonce < 2^128)
//   K0 = Poseidon(viewKey, 5), K1 = Poseidon(viewKey, 6), vkc = Poseidon(viewKey, 7)
//   disclosedValue = PoseidonEncrypt([amount]; [K0,K1], nonce)
// ============================================================================

include "poseidon.circom";                 // circomlib (-l)
include "bitify.circom";                    // circomlib
include "smt/smtverifier.circom";          // circomlib (Poseidon v1 SMT)
include "../lib/aperture/merkle.circom";
include "../lib/aperture/cipher_iso.circom";

template Disclosure(levels, smtLevels) {
    // ---------------- PUBLIC ----------------
    signal input poolRoot;
    signal input aspRoot;
    signal input nullifier;
    signal input viewKeyCommitment;
    signal input disclosedValue[4];   // ciphertext (3 masked slots + auth tag)

    // ---------------- PRIVATE (witness) ----------------
    signal input amount;
    signal input privateKey;
    signal input blinding;
    signal input merklePath;          // packed pool path indices
    signal input pathElements[levels];
    // ASP non-membership witness (circomlib SMT shape)
    signal input aspSiblings[smtLevels];
    signal input aspOldKey;
    signal input aspOldValue;
    signal input aspIsOld0;
    // disclosure
    signal input viewKey;

    // ---- (1) keypair ----
    component pkH = Poseidon(1);
    pkH.inputs[0] <== privateKey;
    signal publicKey <== pkH.out;

    // ---- (2) commitment integrity ----
    component cmH = Poseidon(3);
    cmH.inputs[0] <== amount;
    cmH.inputs[1] <== publicKey;
    cmH.inputs[2] <== blinding;
    signal commitment <== cmH.out;

    // amount range check (prevents field-overflow ambiguity in the disclosed value)
    component amtBits = Num2Bits(248);
    amtBits.in <== amount;

    // ---- (3) pool membership ----
    component tree = MerkleProof(levels);
    tree.leaf <== commitment;
    tree.pathIndices <== merklePath;
    for (var i = 0; i < levels; i++) tree.pathElements[i] <== pathElements[i];
    poolRoot === tree.root;

    // ---- (4) ASP non-membership (publicKey NOT in sanctioned SMT) ----
    component asp = SMTVerifier(smtLevels);
    asp.enabled <== 1;
    asp.fnc <== 1;                      // 1 => verify NON-inclusion
    asp.root <== aspRoot;
    for (var j = 0; j < smtLevels; j++) asp.siblings[j] <== aspSiblings[j];
    asp.oldKey <== aspOldKey;
    asp.oldValue <== aspOldValue;
    asp.isOld0 <== aspIsOld0;
    asp.key <== publicKey;
    asp.value <== 0;

    // ---- (5) nullifier correctness ----
    component sigH = Poseidon(3);
    sigH.inputs[0] <== privateKey;
    sigH.inputs[1] <== commitment;
    sigH.inputs[2] <== merklePath;
    component nfH = Poseidon(3);
    nfH.inputs[0] <== commitment;
    nfH.inputs[1] <== merklePath;
    nfH.inputs[2] <== sigH.out;
    nullifier === nfH.out;

    // nonce = low 128 bits of the nullifier
    component nfBits = Num2Bits(254);
    nfBits.in <== nullifier;
    signal nonceAcc[129];
    nonceAcc[0] <== 0;
    for (var b = 0; b < 128; b++) nonceAcc[b + 1] <== nonceAcc[b] + nfBits.out[b] * (2 ** b);
    signal nonce <== nonceAcc[128];

    // ---- (6) view-key selective disclosure ----
    component vkcH = Poseidon(2);
    vkcH.inputs[0] <== viewKey;
    vkcH.inputs[1] <== 7;
    viewKeyCommitment === vkcH.out;

    component k0H = Poseidon(2);
    k0H.inputs[0] <== viewKey;
    k0H.inputs[1] <== 5;
    component k1H = Poseidon(2);
    k1H.inputs[0] <== viewKey;
    k1H.inputs[1] <== 6;

    // prove disclosedValue decrypts (derived key, nullifier-nonce) to `amount`,
    // with the auth tag enforced inside CPoseidonDecrypt.
    component dec = CPoseidonDecrypt(1);
    dec.nonce <== nonce;
    dec.key[0] <== k0H.out;
    dec.key[1] <== k1H.out;
    for (var c = 0; c < 4; c++) dec.ciphertext[c] <== disclosedValue[c];
    dec.decrypted[0] === amount;
}

component main { public [ poolRoot, aspRoot, nullifier, viewKeyCommitment, disclosedValue ] } = Disclosure(10, 10);
