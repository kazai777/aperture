pragma circom 2.1.5;
// Constraint 3: pool Merkle membership. Satisfiable iff in-circuit root == circomlibjs-built root.
include "../../lib/aperture/merkle.circom";
template Membership(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices;
    signal input expectedRoot;
    component m = MerkleProof(levels);
    m.leaf <== leaf; m.pathIndices <== pathIndices;
    for (var i = 0; i < levels; i++) m.pathElements[i] <== pathElements[i];
    m.root === expectedRoot;
}
component main = Membership(10);
