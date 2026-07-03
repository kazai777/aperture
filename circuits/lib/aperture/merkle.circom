pragma circom 2.1.5;

// Binary Merkle membership (Poseidon v1).
// Recomputes the root from a leaf + sibling path. `pathIndices` is a packed
// bitfield (bit i = 1 iff the node at level i is a RIGHT child), matching the
// off-chain scheme.mjs merkleProof(). Node hash = Poseidon([left, right]),
// matched off-chain by circomlibjs poseidon([left,right]).
//
// Binary Merkle + Switcher ordering; node hash on circomlib Poseidon v1.

include "poseidon.circom";   // circomlib (-l)
include "switcher.circom";   // circomlib
include "bitify.circom";     // circomlib

template MerkleProof(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices;        // packed bits
    signal output root;

    component bits = Num2Bits(levels);
    bits.in <== pathIndices;

    component sw[levels];
    component hashers[levels];
    signal cur[levels + 1];
    cur[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        // sel = 1 => current node is the right child, so sibling goes on the left.
        sw[i] = Switcher();
        sw[i].sel <== bits.out[i];
        sw[i].L <== cur[i];
        sw[i].R <== pathElements[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== sw[i].outL;
        hashers[i].inputs[1] <== sw[i].outR;
        cur[i + 1] <== hashers[i].out;
    }

    root <== cur[levels];
}
