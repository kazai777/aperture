// Witness helper: a circuit ACCEPTS an input iff witness generation succeeds
// (every `===` constraint holds). Throwing => the circuit REJECTED the input.
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as snarkjs from "snarkjs";

let n = 0;
export async function accepts(wasmPath, input) {
  const out = join(tmpdir(), `aperture_w_${process.pid}_${n++}.wtns`);
  try {
    await snarkjs.wtns.calculate(input, wasmPath, out);
    return true;
  } catch {
    return false;
  }
}
