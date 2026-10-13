import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/*.test.ts",
      "apps/extension/src/**/*.test.ts",
      "apps/web/lib/**/*.test.ts",
    ],
    environment: "node",
  },
});
