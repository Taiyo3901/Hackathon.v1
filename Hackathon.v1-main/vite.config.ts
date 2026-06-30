import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",

  plugins: [react()],

  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    chunkSizeWarningLimit: 3000,
  },

  esbuild: {
    target: "es2022",
  },

  optimizeDeps: {
    esbuildOptions: {
      target: "es2022",
    },
  },
});
