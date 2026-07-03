// Aperture in ~10 lines: prove -> verify on-chain -> audit.
// (Node: needs the compiled circuit artifacts + a Stellar CLI identity.)
import { createApertureReal } from "@aperture/sdk/node";

const ap = await createApertureReal({
  artifactDir: "circuits/disclosure/build", // disclosure.wasm + disclosure_final.zkey + verification_key.json
  contractId: process.env.VERIFIER_CONTRACT_ID!,
  source: "aperture-deployer",
  network: "testnet",
});

const proof = await ap.prove({                       // institution: generate the disclosure proof
  amount: 1_250_000n, privateKey: 111222333444n, blinding: 424242n,
  decoyLeaves: [11n, 22n, 33n], sanctionedKeys: [777n, 888n], viewKey: 987654321987654321n,
});
const { verified } = await ap.verifyOnChain(proof);  // verify on Stellar testnet
const { amount } = ap.audit(987654321987654321n, proof); // auditor recovers the disclosed amount
console.log({ verified, amount });                   // -> { verified: true, amount: 1250000n }
