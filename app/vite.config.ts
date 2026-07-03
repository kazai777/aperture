import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Aperture demo. nodePolyfills lets @stellar/stellar-sdk + snarkjs run in the
// browser (Buffer/process/global) so the FULL proof path is client-side.
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
  ],
  server: { port: 5173, fs: { allow: [".."] } },
});
