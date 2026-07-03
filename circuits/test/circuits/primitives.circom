pragma circom 2.1.5;
// Constraints 1,2,5: keypair, commitment, signature, nullifier (Poseidon v1).
// Satisfiable iff in-circuit Poseidon == circomlibjs for each.
include "poseidon.circom";
template Primitives() {
    signal input privateKey;
    signal input amount;
    signal input blinding;
    signal input merklePath;
    signal input expectedPk;
    signal input expectedCm;
    signal input expectedSig;
    signal input expectedNf;
    component pk = Poseidon(1); pk.inputs[0] <== privateKey; pk.out === expectedPk;
    component cm = Poseidon(3); cm.inputs[0] <== amount; cm.inputs[1] <== pk.out; cm.inputs[2] <== blinding; cm.out === expectedCm;
    component sig = Poseidon(3); sig.inputs[0] <== privateKey; sig.inputs[1] <== cm.out; sig.inputs[2] <== merklePath; sig.out === expectedSig;
    component nf = Poseidon(3); nf.inputs[0] <== cm.out; nf.inputs[1] <== merklePath; nf.inputs[2] <== sig.out; nf.out === expectedNf;
}
component main = Primitives();
