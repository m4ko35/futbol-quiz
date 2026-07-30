import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // tsconfig'deki "@/*" takma adının testlerde de çalışması için.
  plugins: [tsconfigPaths()],
  test: {
    // Varsayılan ortam Node: testlerin çoğu tarayıcıya ihtiyaç duymaz ve
    // jsdom kurmak her dosyaya gereksiz maliyet biner. Bileşen testleri
    // kendi dosyalarının başında `@vitest-environment jsdom` ile ortamı
    // değiştirir (PROJECT.md §8.1).
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      // Kapsam eşiği yalnızca iş mantığı katmanları için anlamlı (§8.1).
      include: ["src/domain/**", "src/application/**"],
      reporter: ["text", "html"],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
