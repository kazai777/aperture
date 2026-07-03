# Vendored: Poseidon encryption (in-circuit) — matched pair with @zk-kit/poseidon-cipher

Source: weijiekoh/circomlib, branch `feat/poseidon-encryption`
Commit: ac85e82c1914d47789e2032fb11ceb2cfdd38a2b
Files: poseidon.circom, poseidon_constants.circom, comparators.circom

This is the ORIGINAL implementation that `@zk-kit/poseidon-cipher` (JS, v0.3.2) was
ported from (see the header of @zk-kit/circuits poseidon-cipher.circom). The zk-kit
`@zk-kit/circuits` npm package ships poseidon-cipher.circom with BROKEN includes
(poseidon_old.circom / comparators.circom are not packaged), so we vendor the
self-contained upstream instead.

For coexistence with circomlib's application Poseidon, an ISOLATED copy with renamed
`C*` templates lives in ../aperture/cipher_iso.circom (+ cipher_constants.circom).

Param-identity with the @zk-kit JS decryptor is proven EMPIRICALLY by the full-circuit
round-trip test (circuits/test/full.test.mjs): the in-circuit tag check
(decryptedLast === ciphertext[last]) only passes if the Poseidon constants, rate,
capacity, key format, nonce handling, and tag construction match byte-for-byte.
