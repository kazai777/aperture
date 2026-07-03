// Aperture client — the full disclosure flow:
//   prove (snarkjs) -> verifyOnChain (Soroban) -> audit (Poseidon decrypt).
import { join } from "node:path";
import { DisclosureScheme, type Field } from "./poseidon.js";
import { SnarkjsProver, type DisclosureRequest, type ProofResult } from "./prover.js";
import { StellarCliVerifier, type OnChainResult } from "./verifier.js";
import { PoseidonAuditor, type AuditResult } from "./auditor.js";

export interface ApertureRealConfig {
  /** Dir holding disclosure_js/disclosure.wasm, disclosure_final.zkey, verification_key.json. */
  artifactDir: string;
  contractId: string;
  source: string; // stellar CLI identity alias
  network: string; // "testnet"
  vkPath?: string;
  stellarBin?: string;
}

export interface ApertureReal {
  readonly scheme: DisclosureScheme;
  readonly prover: SnarkjsProver;
  readonly verifier: StellarCliVerifier;
  readonly auditor: PoseidonAuditor;
  /** Institution: generate a real disclosure proof. */
  prove(req: DisclosureRequest): Promise<ProofResult>;
  /** Verify the proof in the deployed Soroban verifier on testnet. */
  verifyOnChain(r: ProofResult): Promise<OnChainResult>;
  /** Auditor: recover the disclosed amount from the view key. */
  audit(viewKey: Field, r: ProofResult): AuditResult;
}

export async function createApertureReal(cfg: ApertureRealConfig): Promise<ApertureReal> {
  const scheme = await DisclosureScheme.create();
  const prover = new SnarkjsProver(scheme, cfg.artifactDir);
  const verifier = new StellarCliVerifier({
    contractId: cfg.contractId,
    source: cfg.source,
    network: cfg.network,
    vkPath: cfg.vkPath ?? join(cfg.artifactDir, "verification_key.json"),
    ...(cfg.stellarBin ? { stellarBin: cfg.stellarBin } : {}),
  });
  const auditor = new PoseidonAuditor(scheme);
  return {
    scheme, prover, verifier, auditor,
    prove: (req) => prover.prove(req),
    verifyOnChain: (r) => verifier.verify(r.proof, r.publicSignals),
    audit: (viewKey, r) => auditor.recover(viewKey, r.disclosedValue, r.nullifier, r.viewKeyCommitment),
  };
}
