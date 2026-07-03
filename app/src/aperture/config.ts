// Demo config. Values come from app/.env.local (VITE_*).
// NOTE: VITE_DEPLOYER_SECRET is a THROWAWAY testnet key, inlined into the client
// bundle ONLY so the demo can submit a real verification tx with no wallet. It
// holds no real value. Production would use a wallet (e.g. Freighter) or a relayer.
export const APERTURE = {
  contractId: import.meta.env.VITE_VERIFIER_CONTRACT_ID as string,
  rpcUrl: (import.meta.env.VITE_STELLAR_RPC_URL as string) ?? "https://soroban-testnet.stellar.org",
  networkPassphrase:
    (import.meta.env.VITE_NETWORK_PASSPHRASE as string) ?? "Test SDF Network ; September 2015",
  deployerSecret: import.meta.env.VITE_DEPLOYER_SECRET as string,
  wasmUrl: "/circuits/disclosure.wasm",
  zkeyUrl: "/circuits/disclosure_final.zkey",
  vkUrl: "/circuits/verification_key.json",
  explorerTx: (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`,
};
