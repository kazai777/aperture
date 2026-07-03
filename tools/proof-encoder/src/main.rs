// proof-encoder — snarkjs (BN254) -> Soroban groth16-verifier CLI args.
//
// Reads a snarkjs verification_key.json + proof.json + public.json and emits:
//   <out>/vk.cli.json     { alpha, beta, gamma, delta, ic[] }  (uncompressed hex)
//   <out>/proof.cli.json  { a, b, c }                          (uncompressed hex)
//   <out>/pub.cli.json    ["<decimal>", ...]                   (plain u256 strings)
//
// Byte layout MUST match Soroban's BN254 host encoding exactly
// (soroban_sdk::crypto::bn254 docs): Ethereum-compatible, BIG-ENDIAN.
//   G1 (64 bytes):  be(X) || be(Y)
//   G2 (128 bytes): be(X.c1) || be(X.c0) || be(Y.c1) || be(Y.c0)   <- imaginary first
//   Fr/Fp (32 bytes): big-endian, reduced mod field modulus.
// NOTE: this is NOT arkworks `serialize_uncompressed` (which is little-endian,
// real-component first). We build big-endian bytes by hand. snarkjs G2 points are
// [[x_c0, x_c1], [y_c0, y_c1], _]; we reorder to c1-first to match Soroban/EIP-197.
//
// Usage: proof-encoder <vk.json> <proof.json> <public.json> <out_dir>

use ark_bn254::Fq;
use ark_ff::{BigInteger, PrimeField};
use serde_json::Value;
use std::str::FromStr;

/// Parse a decimal field-element string and return its 32-byte big-endian encoding.
fn fq_be(s: &str) -> Vec<u8> {
    let f = Fq::from_str(s).expect("invalid Fq decimal string");
    let bytes = f.into_bigint().to_bytes_be();
    assert_eq!(bytes.len(), 32, "BN254 Fq must encode to 32 big-endian bytes");
    bytes
}

// snarkjs G1 = ["x", "y", "1"] -> be(x) || be(y)   (64 bytes)
fn g1_hex(p: &Value) -> String {
    let mut buf = fq_be(p[0].as_str().unwrap());
    buf.extend_from_slice(&fq_be(p[1].as_str().unwrap()));
    assert_eq!(buf.len(), 64);
    hex::encode(buf)
}

// snarkjs G2 = [["x_c0","x_c1"], ["y_c0","y_c1"], _]
//   -> be(x_c1) || be(x_c0) || be(y_c1) || be(y_c0)   (128 bytes, imaginary first)
fn g2_hex(p: &Value) -> String {
    let mut buf = fq_be(p[0][1].as_str().unwrap()); // x.c1
    buf.extend_from_slice(&fq_be(p[0][0].as_str().unwrap())); // x.c0
    buf.extend_from_slice(&fq_be(p[1][1].as_str().unwrap())); // y.c1
    buf.extend_from_slice(&fq_be(p[1][0].as_str().unwrap())); // y.c0
    assert_eq!(buf.len(), 128);
    hex::encode(buf)
}

fn read_json(path: &str) -> Value {
    let s = std::fs::read_to_string(path).unwrap_or_else(|_| panic!("cannot read {path}"));
    serde_json::from_str(&s).unwrap_or_else(|_| panic!("invalid JSON in {path}"))
}

fn assert_bn254(v: &Value, what: &str) {
    if let Some(c) = v.get("curve").and_then(|c| c.as_str()) {
        assert_eq!(c, "bn128", "{what} is not BN254/bn128 (got {c})");
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 5 {
        eprintln!("usage: proof-encoder <vk.json> <proof.json> <public.json> <out_dir>");
        std::process::exit(2);
    }
    let (vk_p, proof_p, pub_p, out) = (&args[1], &args[2], &args[3], &args[4]);

    let vk = read_json(vk_p);
    let proof = read_json(proof_p);
    let pubs = read_json(pub_p);
    assert_bn254(&vk, "verification key");
    assert_bn254(&proof, "proof");

    let ic: Vec<String> = vk["IC"].as_array().unwrap().iter().map(g1_hex).collect();
    let vk_out = serde_json::json!({
        "alpha": g1_hex(&vk["vk_alpha_1"]),
        "beta":  g2_hex(&vk["vk_beta_2"]),
        "gamma": g2_hex(&vk["vk_gamma_2"]),
        "delta": g2_hex(&vk["vk_delta_2"]),
        "ic":    ic,
    });

    let proof_out = serde_json::json!({
        "a": g1_hex(&proof["pi_a"]),
        "b": g2_hex(&proof["pi_b"]),
        "c": g1_hex(&proof["pi_c"]),
    });

    let pub_out: Vec<String> = pubs
        .as_array()
        .expect("public.json must be an array")
        .iter()
        .map(|v| v.as_str().expect("public signal must be a string").to_string())
        .collect();

    std::fs::write(format!("{out}/vk.cli.json"), serde_json::to_string_pretty(&vk_out).unwrap()).unwrap();
    std::fs::write(format!("{out}/proof.cli.json"), serde_json::to_string_pretty(&proof_out).unwrap()).unwrap();
    std::fs::write(format!("{out}/pub.cli.json"), serde_json::to_string(&pub_out).unwrap()).unwrap();

    eprintln!("wrote vk.cli.json, proof.cli.json, pub.cli.json to {out}");
    eprintln!("pub_signals = {}", serde_json::to_string(&pub_out).unwrap());
}
