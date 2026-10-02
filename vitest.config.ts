import { defineConfig } from "vitest/config";

// Konfigurasi terpisah dari vite.config.ts agar tes unit tidak memuat plugin TanStack Start/Nitro.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
