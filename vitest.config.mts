/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    globals: true,
    setupFiles: ["./src/tests/test-setup.ts"],
    exclude: ["node_modules", "dist", "public", "coverage"],
    coverage: {
      provider: "v8",
      exclude: [
        "node_modules/**",
        "src/tests/**",
        "src/db/migrations/**",
        "src/db/seeds/**",
        "src/db/sqlite/**",
        "dist/**",
        "public/**",
        "coverage/**",
        "*.config.*",
        "**/*.d.ts",
        "src/db/knexfile.ts",
        "src/types.ts",
      ],
      include: ["src/**/*.ts"],
      reporter: ["text", "html", "json"],
      reportsDirectory: "./coverage",
    },
  },
});
