pragma circom 2.1.5;
// Constraint 4: ASP SMT non-membership. Satisfiable iff circomlibjs non-membership proof verifies in-circuit.
include "smt/smtverifier.circom";
template NonMembership(n) {
    signal input root;
    signal input siblings[n];
    signal input oldKey;
    signal input oldValue;
    signal input isOld0;
    signal input key;
    component v = SMTVerifier(n);
    v.enabled <== 1; v.fnc <== 1; v.root <== root;
    for (var i = 0; i < n; i++) v.siblings[i] <== siblings[i];
    v.oldKey <== oldKey; v.oldValue <== oldValue; v.isOld0 <== isOld0; v.key <== key; v.value <== 0;
}
component main = NonMembership(10);
