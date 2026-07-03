// Node-side proof generation: build the witness (browser-safe) then run snarkjs
// with local artifact paths. (Browsers build the witness via ./witness.js and call
// snarkjs.groth16.fullProve with URLs instead.)
import { join } from "node:path";
import { groth16 } from "snarkjs";
import { DisclosureScheme, type Field } from "./poseidon.js";
import { buildDisclosureWitness, type DisclosureRequest } from "./witness.js";

export type { DisclosureRequest } from "./witness.js";

export interface ProofResult {
  proof: unknown;
  publicSignals: string[];
  nullifier: Field;
  viewKeyCommitment: Field;
  disclosedValue: Field[];
  poolRoot: Field;
  aspRoot: Field;
}

export class SnarkjsProver {
  constructor(
    private readonly scheme: DisclosureScheme,
    private readonly artifactDir: string,
  ) {}

  async prove(req: DisclosureRequest): Promise<ProofResult> {
    const w = await buildDisclosureWitness(this.scheme, req);
    const wasm = join(this.artifactDir, "disclosure_js", "disclosure.wasm");
    const zkey = join(this.artifactDir, "disclosure_final.zkey");
    const { proof, publicSignals } = await groth16.fullProve(w.input, wasm, zkey);
    return {
      proof, publicSignals,
      nullifier: w.nullifier, viewKeyCommitment: w.viewKeyCommitment,
      disclosedValue: w.disclosedValue, poolRoot: w.poolRoot, aspRoot: w.aspRoot,
    };
  }
}
