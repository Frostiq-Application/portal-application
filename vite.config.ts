/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    // Fail loudly if 5174 is taken rather than silently drifting to the next
    // free port. The dev-tunnel host and the API's CORS allow-list are both
    // keyed to the port, so a silent move turns into an unexplained
    // "Something went wrong" in the browser instead of an error here.
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Only our own specs — never node_modules or the build output.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
