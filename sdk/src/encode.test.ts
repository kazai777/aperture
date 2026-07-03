import { describe, it, expect } from "vitest";
import { encodeProof, encodeVk, encodePublic } from "./encode.js";

const G1 = ["1", "2", "1"];
const G2 = [["3", "4"], ["5", "6"], ["1", "0"]];

describe("BN254 encoder", () => {
  it("encodes G1 to 64-byte hex and G2 to 128-byte hex", () => {
    const p = encodeProof({ pi_a: G1, pi_b: G2, pi_c: G1 });
    expect(p.a).toHaveLength(128); // 64 bytes
    expect(p.b).toHaveLength(256); // 128 bytes
    expect(p.c).toHaveLength(128);
  });

  it("encodes the verification key and preserves ic length", () => {
    const v = encodeVk({ vk_alpha_1: G1, vk_beta_2: G2, vk_gamma_2: G2, vk_delta_2: G2, IC: [G1, G1] });
    expect(v.alpha).toHaveLength(128);
    expect(v.beta).toHaveLength(256);
    expect(v.ic).toHaveLength(2);
    expect(v.ic[0]).toHaveLength(128);
  });

  it("reorders G2 to imaginary-first (c1 || c0)", () => {
    // pi_b = [[c0,c1],...] -> hex must start with be(c1)=4, not be(c0)=3
    const { b } = encodeProof({ pi_a: G1, pi_b: [["3", "4"], ["5", "6"], ["1", "0"]], pi_c: G1 });
    expect(b.slice(0, 64).endsWith("4")).toBe(true); // first 32-byte word = c1 = 4
    expect(b.slice(64, 128).endsWith("3")).toBe(true); // second word = c0 = 3
  });

  it("passes public signals through as decimal strings", () => {
    expect(encodePublic(["33", "7"])).toEqual(["33", "7"]);
  });
});
