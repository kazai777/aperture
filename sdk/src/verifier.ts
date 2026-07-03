// Real on-chain verification: submit the proof to the deployed Soroban verifier on
// Stellar testnet via the stellar CLI. NO mock — this hits the real contract on the
// real network and returns its real true/false plus the transaction hash.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encodeProof, encodeVk, encodePublic } from "./encode.js";

export interface OnChainResult {
  verified: boolean;
  txHash?: string;
  contractId: string;
}

export interface VerifierConfig {
  contractId: string;
  source: string; // stellar CLI identity alias
  network: string; // e.g. "testnet"
  /** Path to the circuit's verification_key.json. */
  vkPath: string;
  stellarBin?: string; // default "stellar"
}

export class StellarCliVerifier {
  constructor(private readonly cfg: VerifierConfig) {}

  async verify(proof: unknown, publicSignals: string[]): Promise<OnChainResult> {
    const vk = JSON.parse(readFileSync(this.cfg.vkPath, "utf8"));
    const dir = mkdtempSync(join(tmpdir(), "aperture-verify-"));
    const vkf = join(dir, "vk.json");
    const pf = join(dir, "proof.json");
    const pubf = join(dir, "pub.json");
    writeFileSync(vkf, JSON.stringify(encodeVk(vk)));
    writeFileSync(pf, JSON.stringify(encodeProof(proof)));
    writeFileSync(pubf, JSON.stringify(encodePublic(publicSignals)));

    const args = [
      "contract", "invoke",
      "--id", this.cfg.contractId,
      "--source", this.cfg.source,
      "--network", this.cfg.network,
      "--send=yes",
      "--", "verify_proof",
      "--vk-file-path", vkf,
      "--proof-file-path", pf,
      "--pub_signals-file-path", pubf,
    ];
    const r = spawnSync(this.cfg.stellarBin ?? "stellar", args, { encoding: "utf8" });
    if (r.status !== 0) {
      throw new Error(`stellar invoke failed (status ${r.status}): ${r.stderr || r.stdout}`);
    }
    const lastLine = (r.stdout || "").trim().split("\n").pop()?.trim();
    const verified = lastLine === "true";
    const txMatch = (r.stderr || "").match(/tx\/([a-f0-9]+)/);
    return { verified, contractId: this.cfg.contractId, ...(txMatch ? { txHash: txMatch[1] } : {}) };
  }
}
