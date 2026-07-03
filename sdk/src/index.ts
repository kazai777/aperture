// @aperture/sdk — browser-safe entry.
//
// Exposes the disclosure scheme, witness builder, BN254 encoder, and auditor —
// everything a client-side app needs to build a witness (circomlibjs/@zk-kit),
// prove with snarkjs, verify via @stellar/stellar-sdk RPC, and decrypt with the
// Poseidon auditor. The Node-only prover and on-chain verifier live in
// "@aperture/sdk/node".
export * from "./encode.js";
export * from "./poseidon.js";
export * from "./witness.js";
export * from "./auditor.js";
