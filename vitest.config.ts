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

    /**
     * KANCA BÜTÇESİ ÖLÇÜLEREK BELİRLENDİ — varsayılan 10 sn değil.
     *
     * Belirti: `npm run verify` ara sıra bütünleşme dosyalarını DOSYA
     * DÜZEYİNDE düşürüyordu ("Hook timed out in 10000ms"); tek bir iddia
     * bile başarısız olmuyordu. Aynı dosyalar tek başına koşturulduğunda
     * hep geçiyordu — 20 Ağustos 2026'da üç dosya birden düştü, üçü birlikte
     * izole koşturulduğunda 2,74 saniyede bitti.
     *
     * SEBEP KANCALARIN KENDİSİ DEĞİL, EŞ ZAMANLILIK. `beforeAll` içinde
     * gömülü SQLite veritabanı açılıyor (34,8 MB) ve 87 test dosyası paralel
     * koşarken disk ile CPU paylaşılıyor. Vitest'in 10 saniyelik varsayılanı
     * bu proje için hiç ölçülmemişti; iş gerçek G/Ç ve bütçe ona göre değil,
     * çerçevenin genel varsayımına göre kurulmuştu.
     *
     * OTUZ SANİYE ÜÇ KATI MARJ demek. Bir kanca gerçekten kilitlenirse test
     * yine düşüyor — sınır kaldırılmadı, ölçüye oturtuldu.
     *
     * `testTimeout` DOKUNULMADI: düşen şey iddialar değil kurulumdu ve
     * ölçülmemiş bir sınırı ölçmeden büyütmek, buradaki düzeltmenin tam
     * tersi olurdu.
     */
    hookTimeout: 30_000,
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
