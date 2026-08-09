import { loadEtlConfig } from "./config";
import { CrestFetcher, SITES } from "./pipeline/crest-fetch";
import { commonsFileUrl } from "./pipeline/crest-url";
import {
  extractCrestFile,
  fileNameFromCrestUrl,
  isPlausibleCrest,
  isUsableFile,
  toAttribution,
  type CrestAttribution,
} from "./pipeline/crest-source";
import { PrismaClient } from "../../src/generated/prisma";

/**
 * Arma geçişi — `npm run db:crests` (PROJECT.md §4.3.1, BR-33, BR-34).
 *
 * NEDEN AYRI BİR KOŞU, ana ETL'in içinde değil. Ana ETL kulüp evrenini
 * SPARQL'den kurar ve saatler sürer; arma tamamlama ise var olan kulüpler
 * üzerinde çalışan, tekrar tekrar koşulabilir bir düzeltmedir. `db:verify` ile
 * aynı sınıfta: veri artefaktı üzerinde çalışır, kod üretmez.
 *
 * KAYNAK SIRASI (§4.3.1): Vikipedi bilgi kutusu (tr→en→it→de→fr) → Wikidata
 * `P154` → Commons kategorisi. Vikipedi önce çünkü armaları daha güncel;
 * ölçüldü ve doğrulandı. Ama aynı ölçüm çoğunun ADİL KULLANIM olduğunu da
 * gösterdi, o yüzden künye Commons'a sorulur: Commons'ta olmayan dosya
 * kullanılmaz (BR-33).
 */

const prisma = new PrismaClient();
const config = loadEtlConfig();

const fetcher = new CrestFetcher({
  userAgent: config.ETL_USER_AGENT,
  requestsPerSecond: config.ETL_REQUESTS_PER_SECOND,
  sparqlEndpoint: config.WIKIDATA_SPARQL_ENDPOINT,
  cacheDir: "scripts/etl/.cache/crests",
});

interface ClubRow {
  id: string;
  wikidataId: string;
  shortName: string;
  crestUrl: string | null;
}

/** Bir kulüp için kabul edilen arma. */
interface Resolved {
  readonly clubId: string;
  readonly file: string;
  readonly url: string;
  readonly attribution: CrestAttribution;
  readonly source: string;
}

// ─── Commons kategorisi (son çare) ─────────────────────────────────────────

const CREST_NAME = /logo|crest|badge|stemma|wappen|arma|escudo|embleme?m?/iu;

async function fetchFromCategory(category: string): Promise<string | null> {
  const names = await fetcher.fetchCategoryFiles(category);

  // SVG önce: ölçeklenebilir ve küçük (§7.3).
  const svg = names.find(
    (n) => CREST_NAME.test(n) && n.toLowerCase().endsWith(".svg"),
  );
  return svg ?? names.find((n) => CREST_NAME.test(n)) ?? null;
}

// ─── Ana akış ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const onlyMissing = !process.argv.includes("--all");

  const clubs: ClubRow[] = await prisma.club.findMany({
    where: onlyMissing ? { crestUrl: null } : {},
    select: { id: true, wikidataId: true, shortName: true, crestUrl: true },
    orderBy: { id: "asc" },
  });

  console.log(
    `Arma geçişi — ${String(clubs.length)} kulüp ` +
      `(${onlyMissing ? "yalnızca armasızlar" : "hepsi"})\n`,
  );

  console.log("=== 1. Kaynak adresleri (Wikidata) ===");
  const sources = await fetcher.fetchSources(clubs);

  // Kulüp → aday dosya. İLK BULAN KAZANIR; sıra §4.3.1'in kaynak sırasıdır.
  const candidates = new Map<string, { file: string; source: string }>();

  console.log("\n=== 2. Vikipedi bilgi kutuları ===");
  for (const site of SITES) {
    const titles = new Map<string, string>();
    for (const club of clubs) {
      if (candidates.has(club.id)) continue;
      const title = sources.get(club.wikidataId)?.articles[site];
      if (title !== undefined) titles.set(club.id, title);
    }
    if (titles.size === 0) continue;

    const found = await fetcher.fetchCandidates(site, titles, extractCrestFile);
    for (const [clubId, file] of found) {
      if (!candidates.has(clubId))
        candidates.set(clubId, { file, source: site });
    }
    console.log(
      `  ${site}: ${String(found.size)} aday (${String(titles.size)} makale)`,
    );
  }

  console.log("\n=== 3. Wikidata P154 (Vikipedi bulamadıysa) ===");
  let fromWikidata = 0;
  for (const club of clubs) {
    if (candidates.has(club.id)) continue;
    const file = sources.get(club.wikidataId)?.logoFile;
    if (file === undefined) continue;
    candidates.set(club.id, { file, source: "wikidata" });
    fromWikidata++;
  }
  console.log(`  ${String(fromWikidata)} aday`);

  console.log("\n=== 4. Commons künyesi ve BR-33 süzgeci ===");
  const metadata = await fetcher.fetchCommonsMetadata(
    [...candidates.values()].map((c) => c.file),
  );

  const resolved: Resolved[] = [];
  const rejected = {
    nonFree: 0,
    noMeta: 0,
    noAttribution: 0,
    badUrl: 0,
    implausible: 0,
  };

  for (const club of clubs) {
    const candidate = candidates.get(club.id);
    if (candidate === undefined) continue;

    // Bilgi kutusunun genel `image` alanı arma yerine stadyum/portre
    // getirebiliyor; ölçüldü (§4.3.1).
    if (!isPlausibleCrest(candidate.file, club.shortName)) {
      rejected.implausible++;
      continue;
    }

    const meta = metadata.get(candidate.file);
    if (meta === undefined || !meta.existsOnCommons) {
      rejected.noMeta++;
      continue;
    }
    if (!isUsableFile(meta)) {
      rejected.nonFree++;
      continue;
    }

    const attribution = toAttribution(candidate.file, meta);
    if (attribution === null) {
      rejected.noAttribution++;
      continue;
    }

    const url = commonsFileUrl(candidate.file);
    if (url === null) {
      rejected.badUrl++;
      continue;
    }

    resolved.push({
      clubId: club.id,
      file: candidate.file,
      url,
      attribution,
      source: candidate.source,
    });
  }

  console.log(`  kabul: ${String(resolved.length)}`);
  console.log(
    `  ret — Commons'ta yok / adil kullanım: ${String(rejected.noMeta)}`,
  );
  console.log(`  ret — NonFree işaretli: ${String(rejected.nonFree)}`);
  console.log(
    `  ret — atıf künyesi eksik (BR-34): ${String(rejected.noAttribution)}`,
  );
  console.log(
    `  ret — arma olmadığı anlaşıldı: ${String(rejected.implausible)}`,
  );
  console.log(`  ret — adres üretilemedi: ${String(rejected.badUrl)}`);

  // ─── 5. Commons kategorisi: hâlâ boş olanlar için son çare ───
  console.log("\n=== 5. Commons kategorisi (son çare) ===");
  const stillEmpty = clubs.filter(
    (c) => !resolved.some((r) => r.clubId === c.id),
  );
  const categoryFiles = new Map<string, string>();

  for (const club of stillEmpty) {
    const category = sources.get(club.wikidataId)?.commonsCategory;
    if (category === undefined) continue;
    const file = await fetchFromCategory(category);
    if (file !== null) categoryFiles.set(club.id, file);
  }

  const categoryMeta = await fetcher.fetchCommonsMetadata([
    ...categoryFiles.values(),
  ]);
  let fromCategory = 0;
  let categoryImplausible = 0;
  const nameOf = new Map(clubs.map((c) => [c.id, c.shortName]));

  for (const [clubId, file] of categoryFiles) {
    // Kategori en gürültülü kaynak: kulübün kategorisinde forma, kupa ve
    // stadyum görselleri de var (§4.3.1).
    if (!isPlausibleCrest(file, nameOf.get(clubId) ?? "")) {
      categoryImplausible++;
      continue;
    }

    const meta = categoryMeta.get(file);
    if (meta === undefined || !isUsableFile(meta)) continue;
    const attribution = toAttribution(file, meta);
    const url = commonsFileUrl(file);
    if (attribution === null || url === null) continue;

    resolved.push({ clubId, file, url, attribution, source: "commons-cat" });
    fromCategory++;
  }
  console.log(
    `  ${String(fromCategory)} aday kabul (${String(categoryFiles.size)} kategoriden, ` +
      `${String(categoryImplausible)} arma olmadığı için elendi)`,
  );

  // ─── 6. Eski armaların künyesini tamamla ───
  //
  // Armalar Faz 4'te künyesiz yüklendi (§7.3). Bu aşama, ELİMİZDEKİ adresten
  // dosya adını geri çözüp Commons'a künyeyi soruyor — yeni bir arma aramıyor.
  // BR-33 burada da geçerli: künyesi alınamayan (yani Commons'ta olmayan) bir
  // arma zaten sitede durmamalı.
  console.log("\n=== 6. Mevcut armaların denetimi ===");
  const stored = await prisma.club.findMany({
    where: { crestUrl: { not: null } },
    select: { id: true, shortName: true, crestUrl: true, crestLicense: true },
  });

  const storedFiles = new Map<string, string>();
  let implausibleStored = 0;

  for (const club of stored) {
    const file = fileNameFromCrestUrl(club.crestUrl ?? "");
    if (file === null) continue;

    // ÖNCEKİ KOŞUDAN KALAN YANLIŞ ARMALAR da burada eleniyor: kural sonradan
    // eklendi ve geriye dönük uygulanmazsa veri kuralı çiğnemeye devam ederdi.
    if (!isPlausibleCrest(file, club.shortName)) {
      await prisma.club.update({
        where: { id: club.id },
        data: {
          crestUrl: null,
          crestLicense: null,
          crestAuthor: null,
          crestFilePage: null,
        },
      });
      implausibleStored++;
      continue;
    }

    if (club.crestLicense === null) storedFiles.set(club.id, file);
  }

  const backfillMeta = await fetcher.fetchCommonsMetadata([
    ...storedFiles.values(),
  ]);
  let credited = 0;
  let unusable = 0;

  for (const [clubId, file] of storedFiles) {
    const meta = backfillMeta.get(file);
    const attribution =
      meta === undefined || !isUsableFile(meta)
        ? null
        : toAttribution(file, meta);

    if (attribution === null) {
      // Künyesi doğrulanamayan arma GÖSTERİLMEZ (BR-34): adresi de silinir,
      // aksi hâlde sitede künyesiz bir görsel kalırdı.
      await prisma.club.update({
        where: { id: clubId },
        data: { crestUrl: null },
      });
      unusable++;
      continue;
    }

    await prisma.club.update({
      where: { id: clubId },
      data: {
        crestLicense: attribution.license,
        crestAuthor: attribution.author,
        crestFilePage: attribution.filePage,
      },
    });
    credited++;
  }

  console.log(`  arma olmadığı için KALDIRILAN: ${String(implausibleStored)}`);
  console.log(`  künyesi tamamlanan: ${String(credited)}`);
  console.log(`  künyesi alınamadığı için KALDIRILAN: ${String(unusable)}`);

  // ─── 7. Yazma ───
  console.log("\n=== 7. Veritabanına yazma ===");
  for (const item of resolved) {
    await prisma.club.update({
      where: { id: item.clubId },
      data: {
        crestUrl: item.url,
        crestLicense: item.attribution.license,
        crestAuthor: item.attribution.author,
        crestFilePage: item.attribution.filePage,
      },
    });
  }

  const bySource = new Map<string, number>();
  for (const item of resolved) {
    bySource.set(item.source, (bySource.get(item.source) ?? 0) + 1);
  }

  console.log(`  ${String(resolved.length)} kulüp güncellendi\n`);
  console.log("  --- kaynağa göre ---");
  for (const [source, count] of [...bySource].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${source.padEnd(14)} ${String(count)}`);
  }

  const [total, withCrest] = await Promise.all([
    prisma.club.count({ where: { isSelectable: true } }),
    prisma.club.count({
      where: { isSelectable: true, crestUrl: { not: null } },
    }),
  ]);
  console.log(
    `\nSeçilebilir kulüplerde arma: ${String(withCrest)}/${String(total)} ` +
      `= %${((withCrest / total) * 100).toFixed(1)}`,
  );

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
