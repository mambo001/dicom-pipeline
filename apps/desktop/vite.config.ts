import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  root: "src/renderer",
  plugins: [react()],
  resolve: {
    alias: {
      "@dicom-pipeline/contracts": resolve(__dirname, "../../packages/contracts/src/index.ts")
    }
  },
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true
  },
  worker: {
    format: "es"
  },
  optimizeDeps: {
    exclude: ["@cornerstonejs/dicom-image-loader"],
    include: [
      "dicom-parser",
      "@cornerstonejs/codec-charls/decodewasmjs",
      "@cornerstonejs/codec-libjpeg-turbo-8bit/decodewasmjs",
      "@cornerstonejs/codec-openjpeg/decodewasmjs",
      "@cornerstonejs/codec-openjph/wasmjs"
    ]
  },
  server: {
    port: 5173
  }
});
