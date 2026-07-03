#![cfg(test)]
extern crate std;

use soroban_sdk::{
    crypto::bn254::{Bn254G1Affine, Bn254G2Affine, Fr},
    vec, BytesN, Env, Vec, U256,
};

use crate::{Groth16Error, Groth16Verifier, Groth16VerifierClient, Proof, VerificationKey};

fn g1_zero(env: &Env) -> Bn254G1Affine {
    Bn254G1Affine::from_bytes(BytesN::from_array(env, &[0u8; 64]))
}
fn g2_zero(env: &Env) -> Bn254G2Affine {
    Bn254G2Affine::from_bytes(BytesN::from_array(env, &[0u8; 128]))
}

// The contract rejects a verifying key whose `ic` length does not match the number
// of public signals (ic.len() must be pub_signals.len() + 1), and it does so before
// touching any curve operation.
#[test]
fn rejects_malformed_vk_length() {
    let env = Env::default();
    let client = Groth16VerifierClient::new(&env, &env.register(Groth16Verifier {}, ()));

    // ic has length 1, but we pass 1 public signal -> needs ic.len() == 2 -> malformed.
    let vk = VerificationKey {
        alpha: g1_zero(&env),
        beta: g2_zero(&env),
        gamma: g2_zero(&env),
        delta: g2_zero(&env),
        ic: Vec::from_array(&env, [g1_zero(&env)]),
    };
    let proof = Proof { a: g1_zero(&env), b: g2_zero(&env), c: g1_zero(&env) };
    let pub_signals: Vec<Fr> = vec![&env, Fr::from_u256(U256::from_u32(&env, 33))];

    let res = client.try_verify_proof(&vk, &proof, &pub_signals);
    assert_eq!(res, Err(Ok(Groth16Error::MalformedVerifyingKey)));
}
