// Prove the FULLY CLIENT-SIDE on-chain verify works via @stellar/stellar-sdk RPC
// (the same bindings code that runs in the browser) — no stellar CLI.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
import { Client } from "./dist/index.js";

const D = dirname(fileURLToPath(import.meta.url));
const ROOT = join(D, "../..");
const B = join(ROOT, "circuits/disclosure/build");
const env = Object.fromEntries(readFileSync(join(ROOT, ".env"), "utf8")
  .split("\n").filter((l) => l && !l.startsWith("#") && l.includes("="))
  .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }));

// BN254 big-endian encoding (same as sdk/src/encode.ts), hex -> Buffer.
const be32 = (d) => BigInt(d).toString(16).padStart(64, "0");
const g1 = (p) => Buffer.from(be32(p[0]) + be32(p[1]), "hex");
const g2 = (p) => Buffer.from(be32(p[0][1]) + be32(p[0][0]) + be32(p[1][1]) + be32(p[1][0]), "hex");

const vkJson = JSON.parse(readFileSync(join(B, "verification_key.json"), "utf8"));
const proofJson = JSON.parse(readFileSync(join(B, "proof.json"), "utf8"));
const pub = JSON.parse(readFileSync(join(B, "public.json"), "utf8"));

const vk = { alpha: g1(vkJson.vk_alpha_1), beta: g2(vkJson.vk_beta_2), gamma: g2(vkJson.vk_gamma_2), delta: g2(vkJson.vk_delta_2), ic: vkJson.IC.map(g1) };
const proof = { a: g1(proofJson.pi_a), b: g2(proofJson.pi_b), c: g1(proofJson.pi_c) };
const pub_signals = pub.map((x) => BigInt(x));

const kp = Keypair.fromSecret(env.DEPLOYER_SECRET);
const signer = basicNodeSigner(kp, env.STELLAR_NETWORK_PASSPHRASE);
const client = new Client({
  contractId: env.VERIFIER_CONTRACT_ID,
  networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
  rpcUrl: env.STELLAR_RPC_URL,
  publicKey: kp.publicKey(),
  signTransaction: signer.signTransaction,
});

console.log("=== client-side RPC verify (no CLI) ===");
const tx = await client.verify_proof({ vk, proof, pub_signals });
console.log("SIMULATED result =", JSON.stringify(tx.result)); // { tag: 'Ok', values: [true] }
const sent = await tx.signAndSend({ force: true }); // force: read-only fn, submit anyway for a real tx hash
const hash = sent.sendTransactionResponse?.hash;
console.log("SUBMITTED tx hash =", hash);
console.log("explorer = https://stellar.expert/explorer/testnet/tx/" + hash);
console.log("ON-CHAIN returned =", JSON.stringify(sent.result));
