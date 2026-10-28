// Unit tests (npm test). They check the app's own logic in plain TypeScript,
// with no database or browser: see tests/unit. The database has its own
// tests in tests/db.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The same "@/..." imports as the app.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
  },
});
