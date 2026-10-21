/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps the build deployable to any static host or sub-path.
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
