import { loadEtlConfig } from "./config";
import { CrestFetcher, SITES, type Site } from "./pipeline/crest-fetch";
import {
  classifyLocalFile,
  extractCrestFile,
  isPlausibleCrest,
  isUsableFile,
  toAttribution,
  type LocalFileMetadata,
  type LocalFileVerdict,
} from "./pipeline/crest-source";
import { PrismaClient } from "../../src/generated/prisma";

/**
 * Arma denetimi — `npm run db:crest-audit` (PROJECT.md §4.3.1).
 *
 * SORU: "Commons'ta yok" diye reddettiğimiz her dosya gerçekten telifli mi?
 *
 * Bu iki ayrı iddia ve geçiş boru hattı ikisini ayırt etmiyordu. Commons'ta
 * bulunmamanın ÜÇ sebebi olabilir:
 *
 *   1. Dosya adil kullanım — telifli, yeniden kullanılamaz.
 *   2. Dosya yalnızca ABD'de özgür — kaynak ülkesinde telifli, kullanılamaz.
 *   3. Dosya ÖZGÜR ama Commons'a hiç taşınmamış — KULLANILABİLİR.
 *
 * Üçüncüsü varsa reddimiz hatalıydı. Bu betik hangisinin kaç tane olduğunu
 * dosya dosya ölçer; tahmin etmez, künyeyi kaynağından okur.
 *
 * YAZMAZ. Ölçüm ile veriyi değiştirmek ayrı işlerdir; bulgular önce okunur.
 */

const prisma = new PrismaClient();
const config = loadEtlConfig();

const fetcher = new CrestFetcher({
  userAgent: config.ETL_USER_AGENT,
  requestsPerSecond: config.ETL_REQUESTS_PER_SECOND,
  sparqlEndpoint: config.WIKIDATA_SPARQL_ENDPOINT,
  cacheDir: "scripts/etl/.cache/crests",
});

interface Candidate {
  readonly clubId: string;
  readonly clubName: string;
  readonly file: string;
  /** Adayın bulunduğu viki; `null` ise Wikidata `P154`. */
  readonly site: Site | null;
}

function tally<T extends string>(values: readonly T[]): [T, number][] {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

async function main(): Promise<void> {
  const clubs = await prisma.club.findMany({
    where: { crestUrl: null },
    select: { id: true, wikidataId: true, shortName: true },
    orderBy: { id: "asc" },
  });

  console.log(`Arma denetimi — ${String(clubs.length)} armasız kulüp\n`);

  console.log("=== 1. Adaylar (geçişle AYNI yoldan) ===");
  const sources = await fetcher.fetchSources(clubs);
  const candidates = new Map<string, Candidate>();

  for (const site of SITES) {
    const titles = new Map<string, string>();
    for (const club of clubs) {
      if (candidates.has(club.id)) continue;
      const title = sources.get(club.wikidataId)?.articles[site];
      if (title !== undefined) titles.set(club.id, title);
    }
    if (titles.size === 0) continue;

    const found = await fetcher.fetchCandidates(site, titles, extractCrestFile);
    const nameOf = new Map(clubs.map((c) => [c.id, c.shortName]));
    for (const [clubId, file] of found) {
      if (candidates.has(clubId)) continue;
      candidates.set(clubId, {
        clubId,
        clubName: nameOf.get(clubId) ?? "",
        file,
        site,
      });
    }
  }

  for (const club of clubs) {
    if (candidates.has(club.id)) continue;
    const file = sources.get(club.wikidataId)?.logoFile;
    if (file === undefined) continue;
    candidates.set(club.id, {
      clubId: club.id,
      clubName: club.shortName,
      file,
      site: null,
    });
  }

  const noCandidate = clubs.length - candidates.size;
  console.log(`  aday bulunan: ${String(candidates.size)}`);
  console.log(`  hiç aday yok: ${String(noCandidate)}`);

  // Arma olmadığı anlaşılanlar denetimin dışında: onların reddi telif değil,
  // "bu dosya bir arma değil" gerekçesine dayanıyor.
  const plausible: Candidate[] = [];
  let implausible = 0;
  for (const candidate of candidates.values()) {
    if (isPlausibleCrest(candidate.file, candidate.clubName)) {
      plausible.push(candidate);
    } else {
      implausible++;
    }
  }
  console.log(`  arma olmadığı için denetim dışı: ${String(implausible)}`);
  console.log(`  DENETLENECEK: ${String(plausible.length)}\n`);

  console.log("=== 2. Commons — yönlendirme İZLENEREK ===");
  const commonsMeta = await fetcher.fetchCommonsMetadata(
    plausible.map((c) => c.file),
  );

  const onCommons: Candidate[] = [];
  const notOnCommons: Candidate[] = [];
  for (const candidate of plausible) {
    const meta = commonsMeta.get(candidate.file);
    if (meta !== undefined && isUsableFile(meta)) {
      onCommons.push(candidate);
    } else {
      notOnCommons.push(candidate);
    }
  }
  console.log(`  Commons'ta ÇIKTI: ${String(onCommons.length)}`);
  console.log(`  Commons'ta yok:   ${String(notOnCommons.length)}\n`);

  console.log("=== 3. Yerel viki künyeleri ===");
  const local = new Map<string, LocalFileMetadata>();
  for (const site of SITES) {
    const files = notOnCommons
      .filter((c) => c.site === site)
      .map((c) => c.file);
    if (files.length === 0) continue;

    const meta = await fetcher.fetchLocalMetadata(site, files);
    for (const [file, value] of meta) local.set(`${site}:${file}`, value);
  }

  const verdicts: LocalFileVerdict[] = [];
  const byVerdict = new Map<LocalFileVerdict, Candidate[]>();
  const rawLabels: string[] = [];

  for (const candidate of notOnCommons) {
    const meta =
      candidate.site === null
        ? undefined
        : local.get(`${candidate.site}:${candidate.file}`);

    const verdict: LocalFileVerdict =
      meta === undefined ? "yok" : classifyLocalFile(meta);

    verdicts.push(verdict);
    byVerdict.set(verdict, [...(byVerdict.get(verdict) ?? []), candidate]);

    if (verdict === "özgür-görünüyor" || verdict === "belirsiz") {
      rawLabels.push(
        `${verdict.padEnd(9)} | ${(candidate.site ?? "P154").padEnd(4)} | ` +
          `${(meta?.licenseShortName ?? "—").slice(0, 18).padEnd(18)} | ` +
          `${(meta?.usageTerms ?? "—").slice(0, 30).padEnd(30)} | ` +
          `telifli=${(meta?.copyrighted ?? "—").padEnd(6)} | ` +
          `${candidate.clubName} — ${candidate.file}`,
      );
    }
  }

  console.log("\n  --- KARAR DAĞILIMI ---");
  for (const [verdict, count] of tally(verdicts)) {
    const pct = ((count / notOnCommons.length) * 100).toFixed(1);
    console.log(
      `  ${verdict.padEnd(16)} ${String(count).padStart(4)}  %${pct}`,
    );
  }

  if (rawLabels.length > 0) {
    console.log("\n  --- ELLE DENETLENECEKLER: HAM ETİKETLER ---");
    console.log(
      "  (künye bu kovada YETMİYOR: dosya sayfasının şablon metni okunmalı)",
    );
    for (const line of rawLabels.slice(0, 80)) console.log(`  ${line}`);
    if (rawLabels.length > 80) {
      console.log(`  … ve ${String(rawLabels.length - 80)} tane daha`);
    }
  }

  // ─── 4. Kurtarılabilirler ───
  console.log("\n=== 4. KULLANILABİLİR OLANLAR ===");

  const recoverable = [...onCommons];
  let noCredit = 0;
  const usable: { candidate: Candidate; license: string }[] = [];

  for (const candidate of recoverable) {
    const meta = commonsMeta.get(candidate.file);
    if (meta === undefined) continue;
    const attribution = toAttribution(candidate.file, meta);
    if (attribution === null) {
      noCredit++;
      continue;
    }
    usable.push({ candidate, license: attribution.license });
  }

  console.log(`  Commons'ta bulunup künyesi tam: ${String(usable.length)}`);
  console.log(`  Commons'ta bulunup künyesi eksik: ${String(noCredit)}`);

  for (const { candidate, license } of usable.slice(0, 60)) {
    console.log(
      `    ${candidate.clubName.padEnd(30)} ${license.padEnd(18)} ${candidate.file}`,
    );
  }
  if (usable.length > 60) {
    console.log(`    … ve ${String(usable.length - 60)} tane daha`);
  }

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
