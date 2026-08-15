import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@/generated/prisma-accounts";

/**
 * Test için tek kullanımlık HESAP veritabanı (§8.1, §11.3).
 *
 * `test-database.ts` ile aynı gerekçe, iki farkla:
 *
 * TURSO'YA BAĞLANMAZ. Testler ağa çıkmamalı — CI'da kimlik bilgisi yok, ve
 * ağa bağlı bir test kırıldığında kodun mu bağlantının mı bozulduğu
 * anlaşılmaz. Turso libSQL konuşur ve SQLite ile uyumludur, yani aynı şema
 * yerel bir dosyada da birebir çalışır. Kısıtların Turso'da da tuttuğu ayrıca
 * ölçüldü (§11.3).
 *
 * ŞEMA GEÇİCİ BİR KOPYAYA YAZILIR. Gerçek şemadaki adres Turso için bir yer
 * tutucudur ve Prisma CLI göç klasörünü ŞEMANIN YANINDA arar. Şemayı olduğu
 * yerde kullanmak `prisma/migrations`'ı — yani FUTBOL veritabanının
 * göçlerini — hesap veritabanına uygulamaya kalkardı.
 */
export interface AccountsTestDatabase {
  readonly prisma: PrismaClient;
  destroy(): Promise<void>;
}

const SCHEMA_SOURCE = "prisma/accounts.schema.prisma";
const MIGRATIONS_SOURCE = "prisma/accounts-migrations";

export function createAccountsDatabase(): AccountsTestDatabase {
  const directory = mkdtempSync(path.join(tmpdir(), "futbol-quiz-hesap-"));
  // Prisma bağlantı dizesinde ters bölü ayırıcıyı kabul etmez.
  const file = path.join(directory, "accounts.db").replaceAll("\\", "/");
  const url = `file:${file}`;

  // Göçler şemanın YANINDAKİ `migrations/` klasöründen okunur.
  cpSync(MIGRATIONS_SOURCE, path.join(directory, "migrations"), {
    recursive: true,
  });

  const schema = readFileSync(SCHEMA_SOURCE, "utf8").replace(
    /url\s*=\s*"[^"]*"/u,
    `url = "${url}"`,
  );
  const schemaPath = path.join(directory, "schema.prisma");
  writeFileSync(schemaPath, schema);

  // Prisma CLI doğrudan Node ile çalıştırılıyor — gerekçe `test-database.ts`
  // içinde yazılı (Windows'ta `.cmd` sarmalayıcısı EINVAL veriyor).
  const prismaCli = createRequire(import.meta.url).resolve(
    "prisma/build/index.js",
  );

  execFileSync(
    process.execPath,
    [prismaCli, "migrate", "deploy", "--schema", schemaPath],
    { stdio: "pipe" },
  );

  const prisma = new PrismaClient({ datasourceUrl: url });

  return {
    prisma,
    async destroy() {
      await prisma.$disconnect();

      // Windows'ta açık tanıtıcı varken silme başarısız olabilir; testi
      // düşürmemeli ama sessiz de kalmamalı (bkz. `test-database.ts`).
      try {
        rmSync(directory, { recursive: true, force: true });
      } catch (error: unknown) {
        console.warn(
          `Geçici hesap veritabanı silinemedi (${directory}): ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  };
}
