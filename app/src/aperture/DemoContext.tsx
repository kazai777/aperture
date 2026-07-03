// Shared demo state: ONE real settlement (real proof + real testnet verification)
// that flows across the four persona views. The institution settles once; the
// counterparty, auditor, and public explorer all read the same live settlement.
import { createContext, useContext, useState, type ReactNode } from "react";
import { proveDisclosure, verifyOnChain, type ProofBundle, type VerifyResult } from "./client.ts";

export const DEMO = {
  amount: 1_250_000n,
  counterparty: "Meridian Capital",
  privateKey: 111222333444n,
  blinding: 424242n,
  viewKey: 987654321987654321n, // the authorized auditor's key
  decoyLeaves: [11n, 22n, 33n, 44n, 55n],
  sanctioned: [777n, 888n, 999n],
};

export interface Settlement {
  amount: bigint; // known to the transacting parties
  counterparty: string;
  bundle: ProofBundle;
  tx: VerifyResult;
  createdAt: number;
}

type Status = "idle" | "proving" | "verifying" | "done" | "error";

interface DemoCtx {
  settlement: Settlement | null;
  status: Status;
  error: string | null;
  settle: () => Promise<void>;
  reset: () => void;
}

const Ctx = createContext<DemoCtx | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function settle() {
    setError(null);
    try {
      setStatus("proving");
      const bundle = await proveDisclosure({
        amount: DEMO.amount, privateKey: DEMO.privateKey, blinding: DEMO.blinding,
        decoyLeaves: DEMO.decoyLeaves, sanctionedKeys: DEMO.sanctioned, viewKey: DEMO.viewKey,
      });
      setStatus("verifying");
      const tx = await verifyOnChain(bundle.proof, bundle.publicSignals);
      if (!tx.verified) throw new Error("on-chain verification returned false");
      setSettlement({ amount: DEMO.amount, counterparty: DEMO.counterparty, bundle, tx, createdAt: Date.now() });
      setStatus("done");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  function reset() {
    setSettlement(null); setStatus("idle"); setError(null);
  }

  return <Ctx.Provider value={{ settlement, status, error, settle, reset }}>{children}</Ctx.Provider>;
}

export function useDemo(): DemoCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDemo must be used within DemoProvider");
  return c;
}
