import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile();
} catch (err) {
  // .env not present (e.g. CI) - fine, RUN_DB_TESTS-gated tests will just skip
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
}

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
