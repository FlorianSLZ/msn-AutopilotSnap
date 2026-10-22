/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { version } from "./version.json";

// base "./" keeps the build deployable to any static host or sub-path.
export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
