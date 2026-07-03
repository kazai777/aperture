// Browser Aperture client — the full disclosure proof path, client-side:
//   prove (snarkjs in-browser) -> verifyOnChain (@stellar/stellar-sdk RPC) -> audit
//   (Poseidon decrypt). Uses the same disclosure scheme as the SDK and bindings tests.
import {
  DisclosureScheme,
  buildDisclosureWitness,
  PoseidonAuditor,
  encodeVk,
  encodeProof,
  encodePublic,
  type DisclosureRequest,
} from "@aperture/sdk";
import { Buffer } from "buffer";
import { groth16 } from "snarkjs";
import { Client as VerifierClient } from "verifier-client";
import { Keypair } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
import { APERTURE } from "./config";

let _scheme: DisclosureScheme | undefined;
async function scheme(): Promise<DisclosureScheme> {
  if (!_scheme) _scheme = await DisclosureScheme.create();
  return _scheme;
}

export async function holderPublicKey(privateKey: bigint): Promise<bigint> {
  return (await scheme()).publicKey(privateKey);
}

export interface ProofBundle {
  proof: unknown;
  publicSignals: string[];
  nullifier: bigint;
  viewKeyCommitment: bigint;
  disclosedValue: bigint[];
}

/** Generate the disclosure proof entirely in the browser (snarkjs + WASM). */
export async function proveDisclosure(req: DisclosureRequest): Promise<ProofBundle> {
  const s = await scheme();
  const w = await buildDisclosureWitness(s, req); // throws if the holder is sanctioned
  const { proof, publicSignals } = await groth16.fullProve(w.input, APERTURE.wasmUrl, APERTURE.zkeyUrl);
  return {
    proof, publicSignals,
    nullifier: w.nullifier, viewKeyCommitment: w.viewKeyCommitment, disclosedValue: w.disclosedValue,
  };
}

let _vk: unknown;
async function loadVk(): Promise<unknown> {
  if (!_vk) _vk = await (await fetch(APERTURE.vkUrl)).json();
  return _vk;
}
const buf = (h: string) => Buffer.from(h, "hex");

export interface VerifyResult {
  verified: boolean;
  txHash?: string;
}

/** Verify the proof on Stellar testnet — submits a real tx and returns its hash. */
export async function verifyOnChain(proof: unknown, publicSignals: string[]): Promise<VerifyResult> {
  const v = encodeVk(await loadVk());
  const p = encodeProof(proof);
  const vk = { alpha: buf(v.alpha), beta: buf(v.beta), gamma: buf(v.gamma), delta: buf(v.delta), ic: v.ic.map(buf) };
  const pr = { a: buf(p.a), b: buf(p.b), c: buf(p.c) };
  const pub_signals = encodePublic(publicSignals).map(BigInt);

  const kp = Keypair.fromSecret(APERTURE.deployerSecret);
  const signer = basicNodeSigner(kp, APERTURE.networkPassphrase);
  const client = new VerifierClient({
    contractId: APERTURE.contractId,
    networkPassphrase: APERTURE.networkPassphrase,
    rpcUrl: APERTURE.rpcUrl,
    publicKey: kp.publicKey(),
    signTransaction: signer.signTransaction,
  });
  const tx = await client.verify_proof({ vk, proof: pr, pub_signals });
  const sent = await tx.signAndSend({ force: true });
  const r: any = sent.result;
  const verified = r === true || r?.value === true || (r?.tag === "Ok" && r?.values?.[0] === true);
  const txHash: string | undefined = (sent as any).sendTransactionResponse?.hash;
  return { verified, ...(txHash ? { txHash } : {}) };
}

export interface AuditOutcome {
  amount: bigint | null;
  ok: boolean;
  reason?: string;
}

/** Auditor recovers the disclosed amount from a view key (real Poseidon decrypt). */
export async function auditRecover(
  viewKey: bigint,
  disclosedValue: bigint[],
  nullifier: bigint,
  viewKeyCommitment: bigint,
): Promise<AuditOutcome> {
  const s = await scheme();
  const r = new PoseidonAuditor(s).recover(viewKey, disclosedValue, nullifier, viewKeyCommitment);
  return { amount: r.amount, ok: r.ok, ...(r.reason ? { reason: r.reason } : {}) };
}
