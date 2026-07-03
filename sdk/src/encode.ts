// BN254 proof/vk -> Soroban verifier CLI args. Ethereum-compatible big-endian:
//   G1 = be(X)||be(Y) (64 bytes); G2 = be(Xc1)||be(Xc0)||be(Yc1)||be(Yc0) (128 bytes).
// Matches the Rust tools/proof-encoder.

const be32 = (dec: string | bigint): string => BigInt(dec).toString(16).padStart(64, "0");

const g1 = (p: string[]): string => be32(p[0]!) + be32(p[1]!);
// snarkjs G2 = [[Xc0,Xc1],[Yc0,Yc1],...]; reorder to imaginary-first.
const g2 = (p: string[][]): string =>
  be32(p[0]![1]!) + be32(p[0]![0]!) + be32(p[1]![1]!) + be32(p[1]![0]!);

export interface ProofArg { a: string; b: string; c: string }
export interface VkArg { alpha: string; beta: string; gamma: string; delta: string; ic: string[] }

export function encodeProof(proof: any): ProofArg {
  return { a: g1(proof.pi_a), b: g2(proof.pi_b), c: g1(proof.pi_c) };
}

export function encodeVk(vk: any): VkArg {
  return {
    alpha: g1(vk.vk_alpha_1),
    beta: g2(vk.vk_beta_2),
    gamma: g2(vk.vk_gamma_2),
    delta: g2(vk.vk_delta_2),
    ic: (vk.IC as string[][]).map(g1),
  };
}

export const encodePublic = (publicSignals: string[]): string[] => publicSignals.map(String);
