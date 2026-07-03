#!/usr/bin/env bash
# Compile all Aperture circuits needed by the test harness (BN254).
set -euo pipefail
cd "$(dirname "$0")"
CIRCOM="${CIRCOM:-circom}"
L="-l node_modules/circomlib/circuits"

echo "==> full disclosure circuit"
mkdir -p disclosure/build
$CIRCOM disclosure/disclosure.circom --r1cs --wasm --sym -p bn128 -o disclosure/build $L

echo "==> per-constraint micro-circuits"
for c in primitives membership nonmembership; do
  $CIRCOM test/circuits/$c.circom --wasm -p bn128 -o test/circuits $L
done
echo "compiled OK"
