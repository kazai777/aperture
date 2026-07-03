#!/usr/bin/env bash
# Full disclosure circuit: trusted setup (demo ceremony) + witness + proof (BN254).
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.cargo/bin:$HOME/.npm-global/bin:$PATH"
B=build
P=15   # 2^15 = 32768 >= ~9560 non-linear constraints

echo "==> compile disclosure circuit (BN254)"
mkdir -p "$B"
circom disclosure.circom --r1cs --wasm --sym -p bn128 -o "$B" -l ../node_modules/circomlib/circuits

echo "==> witness input"
node gen_input.mjs

echo "==> powers of tau (bn128, 2^$P)"
snarkjs powersoftau new bn128 $P "$B/pot_0.ptau" -v >/dev/null
snarkjs powersoftau contribute "$B/pot_0.ptau" "$B/pot_1.ptau" --name=aperture -v -e="aperture disclosure entropy" >/dev/null
snarkjs powersoftau prepare phase2 "$B/pot_1.ptau" "$B/pot_final.ptau" -v >/dev/null

echo "==> groth16 setup + contribution"
snarkjs groth16 setup "$B/disclosure.r1cs" "$B/pot_final.ptau" "$B/disclosure_0.zkey" >/dev/null
snarkjs zkey contribute "$B/disclosure_0.zkey" "$B/disclosure_final.zkey" --name=aperture-c1 -v -e="aperture zkey entropy" >/dev/null
snarkjs zkey export verificationkey "$B/disclosure_final.zkey" "$B/verification_key.json" >/dev/null

echo "==> witness + proof"
# snarkjs CLI wtns calculate avoids the generate_witness.js require()/ESM clash.
snarkjs wtns calculate "$B/disclosure_js/disclosure.wasm" "$B/input.json" "$B/witness.wtns"
snarkjs groth16 prove "$B/disclosure_final.zkey" "$B/witness.wtns" "$B/proof.json" "$B/public.json"

echo "==> off-chain verify"
snarkjs groth16 verify "$B/verification_key.json" "$B/public.json" "$B/proof.json"
echo "==> public signals (poolRoot, aspRoot, nullifier, viewKeyCommitment, disclosedValue[4]):"
cat "$B/public.json"
echo "DONE"
