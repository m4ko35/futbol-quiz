import fs from "node:fs";
import path from "node:path";
import { PrismaLibSQL } from "@prisma/adapter-libsql/web";
import {
  displayNameKey,
  validateDisplayName,
} from "../src/domain/value-objects/display-name";
import {
  isReportReason,
  REPORT_REASON_LABELS,
} from "../src/domain/value-objects/report-reason";
import { PrismaClient } from "../src/generated/prisma-accounts";

/**
 * Görünen ad bildirimlerini listeler ve bir adı sıfırlar — PROJECT.md §11.12.
 *
 * BU BİR İŞLETMECİ ARACIDIR, uygulamanın parçası değil. §11.12 bildirimlerin
 * hiçbir otomatik işlem tetiklemediğini söylüyor: karar insana ait ve bu betik
 * o kararı uygulamanın yolu.
 *
 * NEDEN YÖNETİM EKRANI DEĞİL. Herkese açık bir yönetim yolu, korunması gereken
 * yeni bir yüzey demekti (kimin girebildiği, oturumun nasıl yükseltildiği,
 * yanlışlıkla açık kalması). Tek işletmecili bir projede terminal betiği aynı
 * işi sıfır saldırı yüzeyiyle yapıyor — anahtar zaten `.env`'de.
 *
 *   npm run isle:bildirimler
 *   npm run isle:bildirimler -- --sifirla "Bildirilen Ad"
 */

/**
 * `.env` ELLE OKUNUYOR: `tsx` onu kendiliğinden yüklemiyor ve bu betik
 * uygulamanın ortam doğrulayıcısından geçmiyor — `accounts.config.ts` ile
 * aynı gerekçe ve aynı biçim.
 */
function readEnvFile(): void {
  let contents: string;
  try {
    contents = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
  } catch {
    return; // Ortamdan gelmiş olabilir.
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

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} tanımlı değil (§11.3).`);
  }
  return value;
}

/**
 * Sıfırlanan adın yerine konan yansız değer.
 *
 * BR-46'nın beyaz listesine UYAR (Latin harf, rakam, tire) — uymasaydı
 * kullanıcı kendi adını geçersiz bir durumda bulurdu. Rastgele son ek,
 * birden fazla sıfırlamada tekillik kısıtına takılmamak için.
 */
function neutralName(): string {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6);
  return `Oyuncu-${suffix}`;
}

function client(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaLibSQL({
      url: required("ACCOUNTS_DATABASE_URL"),
      authToken: required("ACCOUNTS_DATABASE_TOKEN"),
    }),
  });
}

async function listele(prisma: PrismaClient): Promise<void> {
  const reports = await prisma.nameReport.findMany({
    select: {
      reason: true,
      createdAt: true,
      reported: { select: { id: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (reports.length === 0) {
    console.log("Bildirim yok.");
    return;
  }

  /** Hedefe göre grupla: işletmecinin sorusu "hangi ad" (§11.12). */
  const byTarget = new Map<
    string,
    { name: string; total: number; reasons: Map<string, number>; last: Date }
  >();

  for (const report of reports) {
    const key = report.reported.id;
    const current = byTarget.get(key) ?? {
      name: report.reported.displayName,
      total: 0,
      reasons: new Map<string, number>(),
      last: report.createdAt,
    };

    current.total += 1;
    current.reasons.set(
      report.reason,
      (current.reasons.get(report.reason) ?? 0) + 1,
    );
    if (report.createdAt > current.last) current.last = report.createdAt;

    byTarget.set(key, current);
  }

  const sorted = [...byTarget.values()].sort((a, b) => b.total - a.total);

  console.log(`BİLDİRİLEN ADLAR (${String(sorted.length)})\n`);
  for (const target of sorted) {
    const breakdown = [...target.reasons.entries()]
      .map(([reason, count]) => {
        // Sebep veritabanında düz metin; bilinmeyen bir değer gelirse
        // (elle yazılmış satır, eski sürüm) olduğu gibi gösterilir.
        const label = isReportReason(reason)
          ? REPORT_REASON_LABELS[reason]
          : reason;
        return `${label}: ${String(count)}`;
      })
      .join(", ");

    console.log(`  ${target.name}`);
    console.log(
      `    ${String(target.total)} bildirim  (${breakdown})  son: ${target.last.toISOString()}`,
    );
  }

  console.log(
    '\nBir adı sıfırlamak için:\n  npm run isle:bildirimler -- --sifirla "Ad"',
  );
}

async function sifirla(prisma: PrismaClient, name: string): Promise<void> {
  // Girdi BR-46'dan geçirilir: geçersiz bir ad zaten hiçbir hesapta olamaz,
  // yani aramaya çıkmadan durmak daha dürüst bir hata veriyor.
  const checked = validateDisplayName(name);
  if (!checked.ok) {
    console.error(`Geçersiz ad: ${name}`);
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { displayNameKey: displayNameKey(name) },
    select: { id: true, displayName: true },
  });

  if (user === null) {
    console.error(`Böyle bir oyuncu yok: ${name}`);
    process.exitCode = 1;
    return;
  }

  const replacement = neutralName();

  /**
   * HESAP SİLİNMİYOR, YALNIZCA AD DEĞİŞİYOR. Kötüye kullanılan şey addı;
   * oyuncunun turları ve puanları onun emeği ve BR-48'in silme yetkisi
   * kullanıcının kendisine ait (§11.6).
   */
  await prisma.user.update({
    where: { id: user.id },
    data: {
      displayName: replacement,
      displayNameKey: displayNameKey(replacement),
    },
  });

  console.log(`"${user.displayName}" → "${replacement}" olarak sıfırlandı.`);
  console.log(
    "Bildirimler DURUYOR: kaydı silmek, aynı kişi tekrar ederse geçmişi görünmez kılardı.",
  );
}

async function main(): Promise<void> {
  readEnvFile();

  const args = process.argv.slice(2);
  const resetIndex = args.indexOf("--sifirla");
  const prisma = client();

  try {
    if (resetIndex === -1) {
      await listele(prisma);
      return;
    }

    const name = args[resetIndex + 1];
    if (name === undefined || name.length === 0) {
      console.error('Kullanım: npm run isle:bildirimler -- --sifirla "Ad"');
      process.exitCode = 1;
      return;
    }

    await sifirla(prisma, name);
  } finally {
    await prisma.$disconnect();
  }
}

// Üst düzey `await` bu betik biçiminde derlenmiyor; `fetch-dataset.ts` ile
// aynı kalıp kullanılıyor.
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
