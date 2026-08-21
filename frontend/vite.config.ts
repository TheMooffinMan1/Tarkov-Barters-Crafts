import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@compute": resolve(root, "../compute"),
    },
  },
  server: {
    port: 5173,
  },
  optimizeDeps: {
    exclude: ["@compute"],
  },
});
