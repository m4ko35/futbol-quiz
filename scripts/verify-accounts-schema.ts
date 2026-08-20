import fs from "node:fs";
import path from "node:path";
import { PrismaLibSQL } from "@prisma/adapter-libsql/web";
import { PrismaClient } from "../src/generated/prisma-accounts";

/**
 * Hesap veritabanının şemasını TURSO'DA sayar — PROJECT.md §11.3, §12.6.
 *
 * NEDEN VAR. `prisma migrate` bu projede bir kez "başarıyla" tamamlandı ve
 * tabloları **yerel bir dosyaya** kurdu; Turso'da hiçbir şey oluşmadı ve
 * hiçbir hata çıkmadı (§11.3). O günden beri kural şu: **"komut hata vermedi"
 * bir kanıt değildir.** Bu betik kanıtı üretiyor — göçten sonra tabloların ve
 * kısıtların gerçekten uzaktaki veritabanında olduğunu sayarak.
 *
 * KISITLAR DA SAYILIYOR, yalnızca tablolar değil. §12'nin iki kuralı doğrudan
 * benzersizlik kısıtlarına dayanıyor: BR-54 (odada en fazla iki koltuk) ve
 * BR-58 (istatistik başına tek deneme). Tablo var ama kısıt yoksa uygulama
 * çalışır görünür ve kural sessizce uygulanmaz — tam olarak kaçınılan durum.
 *
 * Komut:  npx tsx scripts/verify-accounts-schema.ts
 */

/** `.env` elle okunuyor — `prisma/accounts.config.ts` ile aynı gerekçe. */
function readEnvFile(): void {
  let contents: string;
  try {
    contents = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
  } catch {
    return;
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match === null) continue;

    const [, key, rawValue] = match;
    if (key === undefined || rawValue === undefined) continue;
    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue.trim().replace(/^["']|["']$/gu, "");
  }
}

/** §11 ve §12'nin beklediği tablolar. */
const TABLES = [
  "users",
  "daily_rounds",
  "round_answers",
  "name_reports",
  "rooms",
  "room_players",
  "room_answers",
] as const;

/**
 * Kural taşıyan indeksler ve hangi kuralı taşıdıkları.
 *
 * Sıradan hız dizinleri burada YOK: onların eksikliği yavaşlatır, kuralı
 * bozmaz. Buradaki her satırın eksikliği bir iş kuralını sessizce iptal eder.
 */
const CONSTRAINTS: readonly (readonly [string, string])[] = [
  ["users_subjectHash_key", "BR-46 — bir Google hesabı, bir kullanıcı"],
  ["users_displayNameKey_key", "BR-46 — görünen ad tekil"],
  [
    "daily_rounds_userId_puzzleDay_key",
    "BR-43 — bir kullanıcı, bir gün, bir tur",
  ],
  ["round_answers_roundId_statKey_key", "BR-43 — istatistik başına tek deneme"],
  ["round_answers_roundId_playerId_key", "BR-17 — oyuncu turda bir kez"],
  [
    "name_reports_reporterId_reportedId_key",
    "BR-53 — bir hedefi bir kez bildir",
  ],
  ["rooms_code_key", "BR-55 — oda kodu tekil"],
  [
    "room_players_roomId_userId_key",
    "BR-54 — bir kullanıcı bir odada tek koltuk",
  ],
  ["room_players_roomId_seat_key", "BR-54 — bir odada EN FAZLA İKİ koltuk"],
  [
    "room_answers_roomPlayerId_statKey_key",
    "BR-58 — istatistik başına tek deneme",
  ],
  ["room_answers_roomPlayerId_playerId_key", "BR-17'nin oda karşılığı"],
];

interface SchemaRow {
  readonly name: string;
  readonly type: string;
}

async function main(): Promise<void> {
  readEnvFile();

  const url = process.env.ACCOUNTS_DATABASE_URL;
  const authToken = process.env.ACCOUNTS_DATABASE_TOKEN;
  if (url === undefined || authToken === undefined) {
    throw new Error(
      "ACCOUNTS_DATABASE_URL ve ACCOUNTS_DATABASE_TOKEN tanımlı değil (§7.6).",
    );
  }

  /**
   * ADRES EKRANA BASILMIYOR. Turso adresi bir sır değil ama jeton onunla aynı
   * dosyada duruyor ve çıktıyı yapıştırmak alışkanlık hâline geliyor; adresi
   * yazmamak o alışkanlığın maliyetini sıfırlıyor. Onun yerine sunucu adı.
   */
  console.log(`Hedef: ${new URL(url).host}\n`);

  const prisma = new PrismaClient({
    adapter: new PrismaLibSQL({ url, authToken }),
    log: ["error"],
  });

  try {
    /**
     * Etiketli şablon, `$queryRawUnsafe` DEĞİL (§7.2). Sorguda hiçbir
     * değişken yok; `sqlite_master` Prisma'nın sorgu kurucusuyla okunamıyor.
     */
    const rows = await prisma.$queryRaw<SchemaRow[]>`
      SELECT name, type FROM sqlite_master WHERE type IN ('table', 'index')
    `;

    const present = new Set(rows.map((row) => row.name));
    let missing = 0;

    console.log("TABLOLAR");
    for (const table of TABLES) {
      const ok = present.has(table);
      if (!ok) missing += 1;
      console.log(`  ${ok ? "✓" : "✗"} ${table}`);
    }

    console.log("\nKURAL TAŞIYAN KISITLAR");
    for (const [index, rule] of CONSTRAINTS) {
      const ok = present.has(index);
      if (!ok) missing += 1;
      console.log(`  ${ok ? "✓" : "✗"} ${index}\n      ${rule}`);
    }

    if (missing > 0) {
      throw new Error(
        `${String(missing)} nesne EKSİK. Göç Turso'ya uygulanmamış olabilir (§11.3).`,
      );
    }

    console.log(
      `\nTamam: ${String(TABLES.length)} tablo, ${String(CONSTRAINTS.length)} kısıt Turso'da.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
