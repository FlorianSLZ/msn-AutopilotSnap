/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

// base "./" keeps the build deployable to any static host or sub-path.
export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react()],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
