import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "../../src/generated/prisma";
import { loadEtlConfig } from "./config";
import { TARGET_LEAGUES } from "./leagues";
import { extractDataset, verifyLeagueIds } from "./pipeline/extract";
import { loadDataset } from "./pipeline/load";
import { sanitizeSpells, validateDataset } from "./pipeline/validate";
import { WikidataClient } from "./sources/wikidata/client";
import { WikipediaClient } from "./sources/wikipedia/client";

/**
 * ETL komut satırı aracı — PROJECT.md §4.2.
 *
 * Kullanım:
 *   npm run etl                      tam çekim ve yükleme
 *   npm run etl -- verify-leagues    yalnızca lig QID doğrulaması
 *   npm run etl -- --max-clubs=3     küçük deneme koşusu
 *   npm run etl -- --no-cache        disk önbelleğini atla
 *   npm run etl -- --dry-run         çek ve doğrula, veritabanına YAZMA
 *   npm run etl -- --skip-wikipedia  yalnızca Wikidata (§4.3 katmanını ölç)
 *
 * Bu, ağa çıkan tek süreçtir (§7.4). Web uygulaması çalışırken Wikidata'ya
 * veya Vikipedi'ye hiçbir bağlantı kurulmaz.
 */

const CACHE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  ".cache",
);

interface CliOptions {
  command: "run" | "verify-leagues";
  maxClubs?: number;
  noCache: boolean;
  dryRun: boolean;
  skipWikipedia: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = {
    command: "run",
    noCache: false,
    dryRun: false,
    skipWikipedia: false,
  };

  for (const arg of argv) {
    if (arg === "verify-leagues") {
      options.command = "verify-leagues";
    } else if (arg === "--no-cache") {
      options.noCache = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--skip-wikipedia") {
      options.skipWikipedia = true;
    } else if (arg.startsWith("--max-clubs=")) {
      const value = Number.parseInt(arg.slice("--max-clubs=".length), 10);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error(`--max-clubs pozitif tam sayı olmalı: ${arg}`);
      }
      options.maxClubs = value;
    } else {
      throw new Error(`Bilinmeyen argüman: ${arg}`);
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const config = loadEtlConfig();
  const client = new WikidataClient(config, CACHE_DIR);
  const wikipedia = new WikipediaClient(config, CACHE_DIR);

  // ─── Lig doğrulaması — her koşuda çalışır ─────────────────────────────
  console.log("Lig kimlikleri doğrulanıyor…");
  const verification = await verifyLeagueIds(client, {
    noCache: options.noCache,
  });
  console.log(verification.lines.join("\n"));

  if (!verification.ok) {
    throw new Error(
      "Lig doğrulaması başarısız. scripts/etl/leagues.ts içindeki QID'leri " +
        "gözden geçirin — yanlış bir QID tamamen alakasız bir varlığa " +
        "işaret ediyor olabilir.",
    );
  }
  if (options.command === "verify-leagues") {
    console.log("\nTüm lig kimlikleri doğru.");
    return;
  }

  // ─── Çekim ────────────────────────────────────────────────────────────
  const dataset = await extractDataset(client, wikipedia, {
    maxClubs: options.maxClubs,
    noCache: options.noCache,
    skipWikipedia: options.skipWikipedia,
  });

  console.log(
    `\nÇekilen: ${dataset.clubs.length} kulüp, ` +
      `${dataset.players.length} oyuncu, ${dataset.spells.length} dönem`,
  );

  // ─── Ayıklama ve doğrulama (§8.2) ─────────────────────────────────────
  console.log("\nVeri doğruluğu denetleniyor…");

  // Önce kendi içinde çelişen tekil kayıtlar atılır, sonra atılma ORANI
  // denetlenir. Böylece kaynaktaki birkaç yazım hatası tüm yüklemeyi
  // engellemez, ama sistemik bir sorun yine de yakalanır.
  const { spells, rejected } = sanitizeSpells({
    clubs: dataset.clubs,
    players: dataset.players,
    spells: dataset.spells,
  });

  const report = validateDataset({
    clubs: dataset.clubs,
    spells,
    rejected,
    fetchedClubIds: dataset.fetchedClubIds,
    contradictions: dataset.contradictions,
  });

  for (const warning of report.warnings) console.warn(`  ⚠ ${warning}`);

  if (report.errors.length > 0) {
    for (const error of report.errors) console.error(`  ✗ ${error}`);
    throw new Error(
      "Doğrulama başarısız — veritabanı DEĞİŞTİRİLMEDİ. " +
        "Bozuk veriyi yüklemektense durmak doğrudur (§8.2).",
    );
  }
  console.log(
    report.warnings.length === 0
      ? "  ✓ denetimler temiz"
      : `  ✓ bloklayıcı hata yok (${report.warnings.length} uyarı)`,
  );

  if (options.dryRun) {
    console.log("\n--dry-run: veritabanına yazılmadı.");
    return;
  }

  // ─── Yükleme ──────────────────────────────────────────────────────────
  console.log("\nVeritabanına yazılıyor…");
  const prisma = new PrismaClient();
  try {
    const result = await loadDataset(prisma, {
      leagues: TARGET_LEAGUES,
      clubs: dataset.clubs,
      players: dataset.players,
      spells,
      selectableClubIds: dataset.selectableClubIds,
      careerTotals: dataset.careerTotals,
      // Kısmi koşu tüm veritabanını otoriter kabul edemez.
      isFullRun: options.maxClubs === undefined,
    });

    console.log(
      `  ✓ ${result.leagues} lig, ${result.clubs} kulüp, ` +
        `${result.players} oyuncu, ${result.spells} dönem yazıldı`,
    );
    if (result.skippedSpells > 0) {
      console.warn(
        `  ⚠ ${result.skippedSpells} dönem atlandı (oyuncu/kulüp bilgisi eksik)`,
      );
    }
    if (result.removedStalePlayers > 0 || result.removedEmptyClubs > 0) {
      console.log(
        `  ✓ temizlik: ${result.removedStalePlayers} bayat oyuncu, ` +
          `${result.removedEmptyClubs} boş kulüp silindi`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("\nTamamlandı.");
}

main().catch((error: unknown) => {
  console.error(
    `\nETL başarısız: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
