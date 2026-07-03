pragma circom 2.1.5;
include "poseidon.circom";                    // circomlib (via -l)
include "../../lib/aperture/cipher_iso.circom"; // isolated cipher
template Smoke() {
  signal input a;
  signal input b;
  signal output h;
  component p = Poseidon(2);
  p.inputs[0] <== a; p.inputs[1] <== b;
  h <== p.out;
  signal input ct[4];
  signal input nonce;
  signal input k[2];
  component d = CPoseidonDecrypt(1);
  d.nonce <== nonce; d.key[0] <== k[0]; d.key[1] <== k[1];
  for (var i = 0; i < 4; i++) { d.ciphertext[i] <== ct[i]; }
}
component main = Smoke();
