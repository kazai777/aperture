// Emit a full valid disclosure witness input.json (reuses the off-chain scheme).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as s from "../test/scheme.mjs";

const D = dirname(fileURLToPath(import.meta.url));
const LEVELS = 10, SMT_LEVELS = 10;

const amount = 1250000n, viewKey = 987654321987654321n;
const privateKey = 111222333444n, blinding = 424242n;

const pk = await s.publicKey(privateKey);
const cm = await s.commitment(amount, pk, blinding);
const { root: poolRoot, layers } = await s.buildMerkle([11n, 22n, 33n, cm, 55n, 66n], LEVELS);
const { pathElements, pathIndices } = s.merkleProof(layers, 3, LEVELS);
const sig = await s.signature(privateKey, cm, pathIndices);
const nf = await s.nullifier(cm, pathIndices, sig);
const nonce = s.nonceFromNullifier(nf);
const tree = await s.buildSanctionedSMT([777n, 888n, 999n]);
const asp = await s.nonMembershipProof(tree, pk, SMT_LEVELS);
const K0 = await s.deriveK0(viewKey), K1 = await s.deriveK1(viewKey);
const vkc = await s.viewKeyCommitment(viewKey);
const disclosedValue = s.encryptAmount(amount, K0, K1, nonce);

const input = {
  poolRoot, aspRoot: asp.root, nullifier: nf, viewKeyCommitment: vkc, disclosedValue,
  amount, privateKey, blinding, merklePath: pathIndices, pathElements,
  aspSiblings: asp.siblings, aspOldKey: asp.oldKey, aspOldValue: asp.oldValue, aspIsOld0: asp.isOld0,
  viewKey,
};
const str = (o) => JSON.parse(JSON.stringify(o, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
writeFileSync(join(D, "build/input.json"), JSON.stringify(str(input), null, 2));

// Also emit auditor-facing values for the demo/SDK.
writeFileSync(join(D, "build/auditor.json"), JSON.stringify(str({
  nullifier: nf, viewKeyCommitment: vkc, disclosedValue, nonce, viewKey,
  recoveredAmount: s.decryptAmount(disclosedValue, K0, K1, nonce)[0],
}), null, 2));
console.log("wrote build/input.json (amount disclosed =", amount.toString(), ")");
