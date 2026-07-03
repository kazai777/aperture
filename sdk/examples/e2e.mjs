// End-to-end example through @aperture/sdk:
// institution discloses -> proof -> verified on Stellar testnet ->
// auditor recovers the amount -> sanctioned actor rejected.
//
// Run: npm run build && node examples/e2e.mjs   (from sdk/)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApertureReal } from "../dist/node.js";

const D = dirname(fileURLToPath(import.meta.url));
const ROOT = join(D, "../..");

// --- config from the repo .env + built circuit artifacts ---
const env = Object.fromEntries(
  readFileSync(join(ROOT, ".env"), "utf8")
    .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);

const ap = await createApertureReal({
  artifactDir: join(ROOT, "circuits/disclosure/build"),
  contractId: env.VERIFIER_CONTRACT_ID,
  source: env.DEPLOYER_ALIAS || "aperture-deployer",
  network: env.STELLAR_NETWORK || "testnet",
});

const log = (...a) => console.log(...a);
const line = () => log("─".repeat(64));

// --- the institutional disclosure ---
const amount = 1_250_000n;            // 1,250,000 units settled
const privateKey = 111222333444n;
const blinding = 424242n;
const viewKey = 987654321987654321n;  // shared with the authorized auditor
const decoyLeaves = [11n, 22n, 33n, 44n, 55n]; // other notes already in the pool
const sanctioned = [777n, 888n, 999n];          // OFAC-style sanctioned set (ASP)

line(); log("APERTURE — end-to-end through the SDK (BN254, Stellar testnet)"); line();

// 1) Institution generates the disclosure proof (real snarkjs proof).
log("1. Institution settles a private transfer and discloses the amount to its auditor…");
const bundle = await ap.prove({ amount, privateKey, blinding, decoyLeaves, sanctionedKeys: sanctioned, viewKey });
log(`   ✓ real proof generated. Public sees only commitments + ciphertext:`);
log(`     nullifier        = ${bundle.nullifier}`);
log(`     viewKeyCommitment= ${bundle.viewKeyCommitment}`);
log(`     disclosedValue   = [${bundle.disclosedValue.map(String).join(", ").slice(0, 60)}…]  (opaque)`);

// 2) Verify the proof ON-CHAIN on testnet.
log("\n2. Anyone verifies the proof on-chain (Soroban testnet)…");
const onchain = await ap.verifyOnChain(bundle);
log(`   ✓ on-chain verify_proof => ${onchain.verified}`);
if (onchain.txHash) log(`     tx: https://stellar.expert/explorer/testnet/tx/${onchain.txHash}`);
if (!onchain.verified) throw new Error("on-chain verification returned false");

// 3) Auditor recovers the amount from the view key (real Poseidon decrypt).
log("\n3. The authorized auditor (holding the view key) recovers the amount…");
const audit = ap.audit(viewKey, bundle);
log(`   ✓ auditor recovered amount = ${audit.amount}  (ok=${audit.ok})`);
if (!audit.ok || audit.amount !== amount) throw new Error("auditor did not recover the true amount");

// 3b) An unauthorized viewer (wrong key) is rejected, never fooled.
const intruder = ap.audit(viewKey + 1n, bundle);
log(`   ✓ unauthorized viewer (wrong key) => ok=${intruder.ok} (${intruder.reason})`);

// 4) A sanctioned actor attempting the same flow cannot even produce a proof.
log("\n4. A sanctioned actor attempts the same disclosure…");
const sanctionedPk = ap.scheme.publicKey(privateKey); // this holder's pk, now placed in the ASP
let rejected = false;
try {
  await ap.prove({ amount, privateKey, blinding, decoyLeaves, sanctionedKeys: [777n, sanctionedPk, 999n], viewKey });
} catch (e) {
  rejected = true;
  log(`   ✓ rejected — cannot generate a valid proof: ${e.message.split("\n")[0]}`);
}
if (!rejected) throw new Error("sanctioned actor was NOT rejected");

line();
log("Done: prove → on-chain verify → auditor recover → sanctioned reject");
line();
process.exit(0);
