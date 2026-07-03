// Minimal ambient types for untyped deps used on the real proof path.
declare module "circomlibjs" {
  export function buildPoseidon(): Promise<any>;
  export function newMemEmptyTrie(): Promise<any>;
}
declare module "snarkjs" {
  export const groth16: {
    fullProve(
      input: unknown,
      wasmPath: string,
      zkeyPath: string,
    ): Promise<{ proof: any; publicSignals: string[] }>;
    verify(vk: unknown, publicSignals: string[], proof: unknown): Promise<boolean>;
  };
}
