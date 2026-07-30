import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@/generated/prisma";

/**
 * Test için tek kullanımlık, gerçek şemalı SQLite veritabanı (§8.1).
 *
 * NEDEN geliştirme veritabanı kullanılmıyor: entegrasyon testleri kendi
 * verisini kurmalı ve silmelidir. `prisma/dev.db` üzerinde çalışan bir test,
 * ETL'in ürettiği veriye bağımlı olur — o veri değiştiğinde sebepsiz kırılır,
 * kırılmadığında da neyi doğruladığı belirsizleşir.
 *
 * NEDEN `migrate deploy` (elle yazılmış CREATE TABLE değil): şema tanımının
 * tek kaynağı `prisma/schema.prisma`. Elle kurulan bir test şeması, gerçek
 * şemadan sessizce ayrışır ve testler geçerken üretim bozulabilir.
 */
export interface TestDatabase {
  readonly prisma: PrismaClient;
  /**
   * Bağlantı dizesi.
   *
   * Sözleşme testleri route handler'ları GERÇEKTEN çağırır; o kod kendi
   * PrismaClient'ını `DATABASE_URL`'den kurar. Bu yüzden adres dışarıya
   * verilmek zorunda — testin kendi istemcisi yeterli değil.
   */
  readonly url: string;
  destroy(): Promise<void>;
}

export function createTestDatabase(): TestDatabase {
  const directory = mkdtempSync(path.join(tmpdir(), "futbol-quiz-test-"));
  // Prisma bağlantı dizesinde ters bölü ayırıcıyı kabul etmez.
  const file = path.join(directory, "test.db").replaceAll("\\", "/");
  const url = `file:${file}`;

  // Prisma CLI, `npx` yerine doğrudan Node ile çalıştırılıyor. Gerekçe:
  // Windows'ta Node 20+ `.cmd` sarmalayıcılarını `execFileSync` ile
  // çalıştırmayı reddediyor (EINVAL), `shell: true` ise komutu kabuk
  // ayrıştırmasına açar. Paketin giriş noktasını çözüp çalıştırmak ikisinden
  // de kaçınır ve her platformda aynı şekilde davranır.
  const prismaCli = createRequire(import.meta.url).resolve(
    "prisma/build/index.js",
  );

  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  const prisma = new PrismaClient({ datasourceUrl: url });

  return {
    prisma,
    url,
    async destroy() {
      await prisma.$disconnect();

      // Windows'ta dosya, HÂLÂ AÇIK bir tanıtıcı varken silinemez (EPERM).
      // Sözleşme testlerinde route handler'ların kendi PrismaClient'ı da aynı
      // dosyayı açıyor ve bu testin kapatabileceği bir nesne değil.
      //
      // Temizliğin başarısız olması testi düşürmemeli: geçici dizin işletim
      // sistemine ait ve er geç toplanır. Sessizce yutmuyoruz — hata görünür
      // kalsın diye uyarı basılır.
      try {
        rmSync(directory, { recursive: true, force: true });
      } catch (error: unknown) {
        console.warn(
          `Geçici test veritabanı silinemedi (${directory}): ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  };
}
