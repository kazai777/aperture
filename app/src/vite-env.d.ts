/// <reference types="vite/client" />

declare module "snarkjs" {
  export const groth16: {
    fullProve(
      input: unknown,
      wasmUrl: string,
      zkeyUrl: string,
    ): Promise<{ proof: unknown; publicSignals: string[] }>;
  };
}
