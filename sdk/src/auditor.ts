// Real auditor-side disclosure: the view-key holder independently recovers the
// disclosed amount from the on-chain ciphertext. NO mock — real Poseidon decrypt
// (@zk-kit/poseidon-cipher) with the auth tag verified.
import { DisclosureScheme, type Field } from "./poseidon.js";

export interface AuditResult {
  /** Recovered amount, or null if this disclosure is not addressed to this view key. */
  amount: Field | null;
  /** True iff viewKeyCommitment binds this view key AND the ciphertext tag verifies. */
  ok: boolean;
  reason?: string;
}

export class PoseidonAuditor {
  constructor(private readonly scheme: DisclosureScheme) {}

  /**
   * @param viewKey            the auditor's symmetric view key
   * @param ciphertext         public `disclosedValue` (4 field elements)
   * @param nullifier          public nullifier (the nonce is low128 of this)
   * @param viewKeyCommitment  public `viewKeyCommitment`
   */
  recover(viewKey: Field, ciphertext: Field[], nullifier: Field, viewKeyCommitment: Field): AuditResult {
    // 1) confirm this disclosure is bound to our key (else we reject, never fooled)
    if (this.scheme.viewKeyCommitment(viewKey) !== BigInt(viewKeyCommitment)) {
      return { amount: null, ok: false, reason: "viewKeyCommitment does not bind this view key" };
    }
    // 2) recover the amount; decryptAmount throws if the auth tag is invalid
    const nonce = this.scheme.nonceFromNullifier(nullifier);
    const K0 = this.scheme.deriveK0(viewKey);
    const K1 = this.scheme.deriveK1(viewKey);
    try {
      const amount = this.scheme.decryptAmount(ciphertext, K0, K1, nonce);
      return { amount, ok: true };
    } catch (e) {
      return { amount: null, ok: false, reason: `auth tag invalid: ${(e as Error).message}` };
    }
  }
}
