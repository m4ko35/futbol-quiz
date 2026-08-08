import { z } from "zod";

import { loadEtlConfig } from "./config";
import { commonsFileUrl } from "./pipeline/crest-url";
import {
  extractCrestFile,
  fileNameFromCrestUrl,
  isPlausibleCrest,
  isUsableFile,
  toAttribution,
  type CrestAttribution,
  type FileMetadata,
} from "./pipeline/crest-source";
import { JsonHttpClient } from "./sources/http";
import { PrismaClient } from "../../src/generated/prisma";

/**
 * Arma geÃ§iÅŸi â€” `npm run db:crests` (PROJECT.md Â§4.3.1, BR-33, BR-34).
 *
 * NEDEN AYRI BÄ°R KOÅU, ana ETL'in iÃ§inde deÄŸil. Ana ETL kulÃ¼p evrenini
 * SPARQL'den kurar ve saatler sÃ¼rer; arma tamamlama ise var olan kulÃ¼pler
 * Ã¼zerinde Ã§alÄ±ÅŸan, tekrar tekrar koÅŸulabilir bir dÃ¼zeltmedir. `db:verify` ile
 * aynÄ± sÄ±nÄ±fta: veri artefaktÄ± Ã¼zerinde Ã§alÄ±ÅŸÄ±r, kod Ã¼retmez.
 *
 * KAYNAK SIRASI (Â§4.3.1): Vikipedi bilgi kutusu (trâ†’enâ†’itâ†’deâ†’fr) â†’ Wikidata
 * `P154` â†’ Commons kategorisi. Vikipedi Ã¶nce Ã§Ã¼nkÃ¼ armalarÄ± daha gÃ¼ncel;
 * Ã¶lÃ§Ã¼ldÃ¼ ve doÄŸrulandÄ±. Ama aynÄ± Ã¶lÃ§Ã¼m Ã§oÄŸunun ADÄ°L KULLANIM olduÄŸunu da
 * gÃ¶sterdi, o yÃ¼zden kÃ¼nye Commons'a sorulur: Commons'ta olmayan dosya
 * kullanÄ±lmaz (BR-33).
 */

const SITES = ["tr", "en", "it", "de", "fr"] as const;
type Site = (typeof SITES)[number];

/** MediaWiki baÅŸlÄ±k uÃ§larÄ±nÄ±n Ã¼st sÄ±nÄ±rÄ±. */
const TITLE_BATCH = 50;

const prisma = new PrismaClient();
const config = loadEtlConfig();

const commons = new JsonHttpClient({
  userAgent: config.ETL_USER_AGENT,
  requestsPerSecond: config.ETL_REQUESTS_PER_SECOND,
  cacheDir: "scripts/etl/.cache/crests",
});

const wikis = new Map<Site, JsonHttpClient>();
function wikiClient(site: Site): JsonHttpClient {
  const existing = wikis.get(site);
  if (existing !== undefined) return existing;
  const client = new JsonHttpClient({
    userAgent: config.ETL_USER_AGENT,
    requestsPerSecond: config.ETL_REQUESTS_PER_SECOND,
    cacheDir: "scripts/etl/.cache/crests",
  });
  wikis.set(site, client);
  return client;
}

const sparqlClient = new JsonHttpClient({
  userAgent: config.ETL_USER_AGENT,
  requestsPerSecond: config.ETL_REQUESTS_PER_SECOND,
  cacheDir: "scripts/etl/.cache/crests",
  accept: "application/sparql-results+json",
});

// â”€â”€â”€ Åemalar (Â§2.3: ayrÄ±ÅŸtÄ±rÄ±lmamÄ±ÅŸ girdi iÃ§ katmanlara geÃ§emez) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SparqlSchema = z.object({
  results: z.object({
    bindings: z.array(z.record(z.string(), z.object({ value: z.string() }))),
  }),
});

const WikitextSchema = z.object({
  query: z
    .object({
      normalized: z
        .array(z.object({ from: z.string(), to: z.string() }))
        .optional(),
      redirects: z
        .array(z.object({ from: z.string(), to: z.string() }))
        .optional(),
      pages: z
        .array(
          z.object({
            title: z.string(),
            revisions: z
              .array(
                z.object({
                  slots: z
                    .object({
                      main: z.object({ content: z.string().optional() }),
                    })
                    .optional(),
                }),
              )
              .optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

const ImageInfoSchema = z.object({
  query: z
    .object({
      pages: z
        .array(
          z.object({
            title: z.string(),
            missing: z.boolean().optional(),
            imageinfo: z
              .array(
                z.object({
                  extmetadata: z
                    .record(
                      z.string(),
                      z.object({ value: z.unknown() }).loose(),
                    )
                    .optional(),
                }),
              )
              .optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

const CategorySchema = z.object({
  query: z
    .object({
      categorymembers: z.array(z.object({ title: z.string() })).optional(),
    })
    .optional(),
});

// â”€â”€â”€ YardÄ±mcÄ±lar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function batches<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

function metaString(
  meta: Record<string, { value: unknown }> | undefined,
  key: string,
): string | null {
  const value = meta?.[key]?.value;
  return typeof value === "string" ? value : null;
}

function titleFromUrl(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  try {
    return decodeURIComponent(url.split("/").pop() ?? "").replace(/_/gu, " ");
  } catch {
    return undefined;
  }
}

interface ClubRow {
  id: string;
  wikidataId: string;
  shortName: string;
  crestUrl: string | null;
}

interface Sources {
  readonly articles: Partial<Record<Site, string>>;
  readonly commonsCategory?: string;
  /** Wikidata `P154` dosya adÄ±. */
  readonly logoFile?: string;
}

/** Bir kulÃ¼p iÃ§in kabul edilen arma. */
interface Resolved {
  readonly clubId: string;
  readonly file: string;
  readonly url: string;
  readonly attribution: CrestAttribution;
  readonly source: string;
}

// â”€â”€â”€ AÅŸama 1: kaynak adresleri â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchSources(
  clubs: readonly ClubRow[],
): Promise<Map<string, Sources>> {
  const out = new Map<string, Sources>();

  for (const [index, batch] of batches(clubs, 200).entries()) {
    const values = batch.map((c) => `wd:${c.wikidataId}`).join(" ");
    const optional = SITES.map(
      (s) =>
        `OPTIONAL { ?${s} schema:about ?item ; schema:isPartOf <https://${s}.wikipedia.org/> }`,
    ).join("\n");

    const query = `
      SELECT ?item ${SITES.map((s) => `?${s}`).join(" ")} ?cat ?logo WHERE {
        VALUES ?item { ${values} }
        ${optional}
        OPTIONAL { ?item wdt:P373 ?cat }
        OPTIONAL { ?item wdt:P154 ?logo }
      }`;

    const url = new URL(config.WIKIDATA_SPARQL_ENDPOINT);
    url.searchParams.set("format", "json");
    url.searchParams.set("query", query);

    const data = await sparqlClient.getJson(url, SparqlSchema, {
      label: `crest-sources-${index}-${batch.length}`,
      cacheKey: query,
      describe: (v) => `${v.results.bindings.length} satÄ±r`,
    });

    for (const row of data.results.bindings) {
      const qid = row.item?.value.split("/").pop();
      if (qid === undefined) continue;

      const articles: Partial<Record<Site, string>> = {};
      for (const site of SITES) articles[site] = titleFromUrl(row[site]?.value);

      out.set(qid, {
        articles,
        commonsCategory: row.cat?.value,
        logoFile: titleFromUrl(row.logo?.value),
      });
    }
  }

  return out;
}

// â”€â”€â”€ AÅŸama 2: Vikipedi bilgi kutularÄ±ndan aday dosyalar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchCandidates(
  site: Site,
  titles: ReadonlyMap<string, string>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const byTitle = new Map<string, string>();
  for (const [clubId, title] of titles) byTitle.set(title, clubId);

  for (const [index, batch] of batches(
    [...titles.values()],
    TITLE_BATCH,
  ).entries()) {
    const url = new URL(`https://${site}.wikipedia.org/w/api.php`);
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      redirects: "1",
      titles: batch.join("|"),
    }).toString();

    const data = await wikiClient(site).getJson(url, WikitextSchema, {
      label: `crest-${site}-${index}-${batch.length}`,
      describe: (v) => `${v.query?.pages?.length ?? 0} sayfa`,
    });

    // BaÅŸlÄ±k normalleÅŸtirme/yÃ¶nlendirme zincirini geri Ã§Ã¶z.
    const backTo = new Map<string, string>();
    for (const step of [
      ...(data.query?.normalized ?? []),
      ...(data.query?.redirects ?? []),
    ]) {
      backTo.set(step.to, step.from);
    }

    for (const page of data.query?.pages ?? []) {
      const content = page.revisions?.[0]?.slots?.main?.content;
      if (content === undefined) continue;

      let asked = page.title;
      for (let hop = 0; hop < 4 && backTo.has(asked); hop++) {
        asked = backTo.get(asked) ?? asked;
      }

      const clubId = byTitle.get(asked);
      if (clubId === undefined) continue;

      const file = extractCrestFile(content);
      if (file !== null) out.set(clubId, file);
    }
  }

  return out;
}

// â”€â”€â”€ AÅŸama 3: Commons kÃ¼nyesi â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchMetadata(
  files: readonly string[],
): Promise<Map<string, FileMetadata>> {
  const out = new Map<string, FileMetadata>();

  for (const [index, batch] of batches(
    [...new Set(files)],
    TITLE_BATCH,
  ).entries()) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "imageinfo",
      iiprop: "extmetadata",
      titles: batch.map((f) => `File:${f}`).join("|"),
    }).toString();

    const data = await commons.getJson(url, ImageInfoSchema, {
      label: `crest-meta-${index}-${batch.length}`,
      describe: (v) => `${v.query?.pages?.length ?? 0} dosya`,
    });

    for (const page of data.query?.pages ?? []) {
      const name = page.title.slice(page.title.indexOf(":") + 1);
      const meta = page.imageinfo?.[0]?.extmetadata;

      out.set(name, {
        existsOnCommons: page.missing !== true && meta !== undefined,
        licenseShortName: metaString(meta, "LicenseShortName"),
        artist: metaString(meta, "Artist"),
        attributionRequired: metaString(meta, "AttributionRequired") === "true",
        nonFree: metaString(meta, "NonFree") === "true",
      });
    }
  }

  return out;
}

// â”€â”€â”€ AÅŸama 4: Commons kategorisi (son Ã§are) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CREST_NAME = /logo|crest|badge|stemma|wappen|arma|escudo|embleme?m?/iu;

async function fetchFromCategory(category: string): Promise<string | null> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    list: "categorymembers",
    cmtype: "file",
    cmlimit: "100",
    cmtitle: `Category:${category}`,
  }).toString();

  const data = await commons.getJson(url, CategorySchema, {
    label: `crest-cat-${category.slice(0, 40)}`,
    describe: (v) => `${v.query?.categorymembers?.length ?? 0} dosya`,
  });

  const names = (data.query?.categorymembers ?? []).map((m) =>
    m.title.slice(m.title.indexOf(":") + 1),
  );

  // SVG Ã¶nce: Ã¶lÃ§eklenebilir ve kÃ¼Ã§Ã¼k (Â§7.3).
  const svg = names.find(
    (n) => CREST_NAME.test(n) && n.toLowerCase().endsWith(".svg"),
  );
  return svg ?? names.find((n) => CREST_NAME.test(n)) ?? null;
}

// â”€â”€â”€ Ana akÄ±ÅŸ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function main(): Promise<void> {
  const onlyMissing = !process.argv.includes("--all");

  const clubs: ClubRow[] = await prisma.club.findMany({
    where: onlyMissing ? { crestUrl: null } : {},
    select: { id: true, wikidataId: true, shortName: true, crestUrl: true },
    orderBy: { id: "asc" },
  });

  console.log(
    `Arma geÃ§iÅŸi â€” ${String(clubs.length)} kulÃ¼p ` +
      `(${onlyMissing ? "yalnÄ±zca armasÄ±zlar" : "hepsi"})\n`,
  );

  console.log("=== 1. Kaynak adresleri (Wikidata) ===");
  const sources = await fetchSources(clubs);

  // KulÃ¼p â†’ aday dosya. Ä°LK BULAN KAZANIR; sÄ±ra Â§4.3.1'in kaynak sÄ±rasÄ±dÄ±r.
  const candidates = new Map<string, { file: string; source: string }>();

  console.log("\n=== 2. Vikipedi bilgi kutularÄ± ===");
  for (const site of SITES) {
    const titles = new Map<string, string>();
    for (const club of clubs) {
      if (candidates.has(club.id)) continue;
      const title = sources.get(club.wikidataId)?.articles[site];
      if (title !== undefined) titles.set(club.id, title);
    }
    if (titles.size === 0) continue;

    const found = await fetchCandidates(site, titles);
    for (const [clubId, file] of found) {
      if (!candidates.has(clubId))
        candidates.set(clubId, { file, source: site });
    }
    console.log(
      `  ${site}: ${String(found.size)} aday (${String(titles.size)} makale)`,
    );
  }

  console.log("\n=== 3. Wikidata P154 (Vikipedi bulamadÄ±ysa) ===");
  let fromWikidata = 0;
  for (const club of clubs) {
    if (candidates.has(club.id)) continue;
    const file = sources.get(club.wikidataId)?.logoFile;
    if (file === undefined) continue;
    candidates.set(club.id, { file, source: "wikidata" });
    fromWikidata++;
  }
  console.log(`  ${String(fromWikidata)} aday`);

  console.log("\n=== 4. Commons kÃ¼nyesi ve BR-33 sÃ¼zgeci ===");
  const metadata = await fetchMetadata(
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

    // Bilgi kutusunun genel `image` alanÄ± arma yerine stadyum/portre
    // getirebiliyor; Ã¶lÃ§Ã¼ldÃ¼ (Â§4.3.1).
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
    `  ret â€” Commons'ta yok / adil kullanÄ±m: ${String(rejected.noMeta)}`,
  );
  console.log(`  ret â€” NonFree iÅŸaretli: ${String(rejected.nonFree)}`);
  console.log(
    `  ret â€” atÄ±f kÃ¼nyesi eksik (BR-34): ${String(rejected.noAttribution)}`,
  );
  console.log(
    `  ret â€” arma olmadÄ±ÄŸÄ± anlaÅŸÄ±ldÄ±: ${String(rejected.implausible)}`,
  );
  console.log(`  ret â€” adres Ã¼retilemedi: ${String(rejected.badUrl)}`);

  // â”€â”€â”€ 5. Commons kategorisi: hÃ¢lÃ¢ boÅŸ olanlar iÃ§in son Ã§are â”€â”€â”€
  console.log("\n=== 5. Commons kategorisi (son Ã§are) ===");
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

  const categoryMeta = await fetchMetadata([...categoryFiles.values()]);
  let fromCategory = 0;
  let categoryImplausible = 0;
  const nameOf = new Map(clubs.map((c) => [c.id, c.shortName]));

  for (const [clubId, file] of categoryFiles) {
    // Kategori en gÃ¼rÃ¼ltÃ¼lÃ¼ kaynak: kulÃ¼bÃ¼n kategorisinde forma, kupa ve
    // stadyum gÃ¶rselleri de var (Â§4.3.1).
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
      `${String(categoryImplausible)} arma olmadÄ±ÄŸÄ± iÃ§in elendi)`,
  );

  // â”€â”€â”€ 6. Eski armalarÄ±n kÃ¼nyesini tamamla â”€â”€â”€
  //
  // Armalar Faz 4'te kÃ¼nyesiz yÃ¼klendi (Â§7.3). Bu aÅŸama, ELÄ°MÄ°ZDEKÄ° adresten
  // dosya adÄ±nÄ± geri Ã§Ã¶zÃ¼p Commons'a kÃ¼nyeyi soruyor â€” yeni bir arma aramÄ±yor.
  // BR-33 burada da geÃ§erli: kÃ¼nyesi alÄ±namayan (yani Commons'ta olmayan) bir
  // arma zaten sitede durmamalÄ±.
  console.log("\n=== 6. Mevcut armalarÄ±n denetimi ===");
  const stored = await prisma.club.findMany({
    where: { crestUrl: { not: null } },
    select: { id: true, shortName: true, crestUrl: true, crestLicense: true },
  });

  const storedFiles = new Map<string, string>();
  let implausibleStored = 0;

  for (const club of stored) {
    const file = fileNameFromCrestUrl(club.crestUrl ?? "");
    if (file === null) continue;

    // Ã–NCEKÄ° KOÅUDAN KALAN YANLIÅ ARMALAR da burada eleniyor: kural sonradan
    // eklendi ve geriye dÃ¶nÃ¼k uygulanmazsa veri kuralÄ± Ã§iÄŸnemeye devam ederdi.
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

  const backfillMeta = await fetchMetadata([...storedFiles.values()]);
  let credited = 0;
  let unusable = 0;

  for (const [clubId, file] of storedFiles) {
    const meta = backfillMeta.get(file);
    const attribution =
      meta === undefined || !isUsableFile(meta)
        ? null
        : toAttribution(file, meta);

    if (attribution === null) {
      // KÃ¼nyesi doÄŸrulanamayan arma GÃ–STERÄ°LMEZ (BR-34): adresi de silinir,
      // aksi hÃ¢lde sitede kÃ¼nyesiz bir gÃ¶rsel kalÄ±rdÄ±.
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

  console.log(
    `  arma olmadÄ±ÄŸÄ± iÃ§in KALDIRILAN: ${String(implausibleStored)}`,
  );
  console.log(`  kÃ¼nyesi tamamlanan: ${String(credited)}`);
  console.log(
    `  kÃ¼nyesi alÄ±namadÄ±ÄŸÄ± iÃ§in KALDIRILAN: ${String(unusable)}`,
  );

  // â”€â”€â”€ 7. Yazma â”€â”€â”€
  console.log("\n=== 7. VeritabanÄ±na yazma ===");
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

  console.log(`  ${String(resolved.length)} kulÃ¼p gÃ¼ncellendi\n`);
  console.log("  --- kaynaÄŸa gÃ¶re ---");
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
    `\nSeÃ§ilebilir kulÃ¼plerde arma: ${String(withCrest)}/${String(total)} ` +
      `= %${((withCrest / total) * 100).toFixed(1)}`,
  );

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
