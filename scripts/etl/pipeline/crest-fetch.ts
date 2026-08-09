import { z } from "zod";

import type { FileMetadata, LocalFileMetadata } from "./crest-source";
import { JsonHttpClient } from "../sources/http";

/**
 * Arma kaynaklarının AĞ UÇLARI — PROJECT.md §4.3.1, §7.4.
 *
 * NEDEN AYRI MODÜL. `crests.ts` (geçiş) ve `crest-audit.ts` (denetim) aynı
 * adayları görmek ZORUNDA. Denetim, geçişin reddettiği dosyaları başka bir
 * yoldan türetseydi ölçtüğü şey geçişin davranışı olmazdı ve "şu 507 dosya
 * telifli" cümlesi dayanaksız kalırdı. Burada ortaklık üslup değil, DOĞRULUK
 * şartı.
 *
 * Karar verilmez, yalnızca veri getirilir: "bu dosya kullanılabilir mi"
 * sorusunun cevabı saf `crest-source.ts`'te.
 */

export const SITES = ["tr", "en", "it", "de", "fr"] as const;
export type Site = (typeof SITES)[number];

/** MediaWiki başlık uçlarının üst sınırı. */
const TITLE_BATCH = 50;

// ─── Şemalar (§2.3: ayrıştırılmamış girdi iç katmanlara geçemez) ─────────────

const SparqlSchema = z.object({
  results: z.object({
    bindings: z.array(z.record(z.string(), z.object({ value: z.string() }))),
  }),
});

const TitleFixupSchema = z.object({
  normalized: z
    .array(z.object({ from: z.string(), to: z.string() }))
    .optional(),
  redirects: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
});

const WikitextSchema = z.object({
  query: TitleFixupSchema.extend({
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
  }).optional(),
});

const ExtMetadataSchema = z
  .record(z.string(), z.object({ value: z.unknown() }).loose())
  .optional();

const ImageInfoSchema = z.object({
  query: TitleFixupSchema.extend({
    pages: z
      .array(
        z.object({
          title: z.string(),
          missing: z.boolean().optional(),
          /** `local` | `shared` (Commons) | `""` (yok) */
          imagerepository: z.string().optional(),
          imageinfo: z
            .array(z.object({ extmetadata: ExtMetadataSchema }))
            .optional(),
        }),
      )
      .optional(),
  }).optional(),
});

const CategorySchema = z.object({
  query: z
    .object({
      categorymembers: z.array(z.object({ title: z.string() })).optional(),
    })
    .optional(),
});

// ─── Yardımcılar ────────────────────────────────────────────────────────────

export function batches<T>(items: readonly T[], size: number): T[][] {
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

/** `Dosya:X.svg` / `File:X.svg` → `X.svg` (ad alanı dile göre değişir). */
function stripNamespace(title: string): string {
  return title.slice(title.indexOf(":") + 1);
}

/**
 * MediaWiki'nin başlık düzeltme zincirini TERSİNE çözer.
 *
 * Sorduğumuz ad ile yanıttaki ad aynı olmayabilir: başlık normalleştirilir
 * (`_` → boşluk) ve dosya yönlendirmeleri izlenir. Eşleme yapılmazsa sonuçlar
 * sorulan adla birleştirilemez.
 */
function backwardMap(
  query: z.infer<typeof TitleFixupSchema>,
): Map<string, string> {
  const backTo = new Map<string, string>();
  for (const step of [
    ...(query.normalized ?? []),
    ...(query.redirects ?? []),
  ]) {
    backTo.set(step.to, step.from);
  }
  return backTo;
}

function originalTitle(asked: string, backTo: ReadonlyMap<string, string>) {
  let title = asked;
  for (let hop = 0; hop < 4 && backTo.has(title); hop++) {
    title = backTo.get(title) ?? title;
  }
  return title;
}

export interface CrestClub {
  readonly id: string;
  readonly wikidataId: string;
  readonly shortName: string;
}

export interface Sources {
  readonly articles: Partial<Record<Site, string>>;
  readonly commonsCategory?: string;
  /** Wikidata `P154` dosya adı. */
  readonly logoFile?: string;
}

export interface CrestFetcherOptions {
  readonly userAgent: string;
  readonly requestsPerSecond: number;
  readonly sparqlEndpoint: string;
  readonly cacheDir: string;
}

/** Arma kaynaklarının tek ağ yüzeyi. */
export class CrestFetcher {
  readonly #options: CrestFetcherOptions;
  readonly #commons: JsonHttpClient;
  readonly #sparql: JsonHttpClient;
  readonly #wikis = new Map<Site, JsonHttpClient>();

  constructor(options: CrestFetcherOptions) {
    this.#options = options;
    this.#commons = this.#client();
    this.#sparql = this.#client("application/sparql-results+json");
  }

  #client(accept?: string): JsonHttpClient {
    return new JsonHttpClient({
      userAgent: this.#options.userAgent,
      requestsPerSecond: this.#options.requestsPerSecond,
      cacheDir: this.#options.cacheDir,
      ...(accept === undefined ? {} : { accept }),
    });
  }

  /** Hız sınırı SUNUCU BAŞINA; her viki ayrı istemci alır. */
  #wiki(site: Site): JsonHttpClient {
    const existing = this.#wikis.get(site);
    if (existing !== undefined) return existing;
    const client = this.#client();
    this.#wikis.set(site, client);
    return client;
  }

  // ─── 1. Kaynak adresleri ──────────────────────────────────────────────────

  async fetchSources(
    clubs: readonly CrestClub[],
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

      const url = new URL(this.#options.sparqlEndpoint);
      url.searchParams.set("format", "json");
      url.searchParams.set("query", query);

      const data = await this.#sparql.getJson(url, SparqlSchema, {
        label: `crest-sources-${index}-${batch.length}`,
        cacheKey: query,
        describe: (v) => `${v.results.bindings.length} satır`,
      });

      for (const row of data.results.bindings) {
        const qid = row.item?.value.split("/").pop();
        if (qid === undefined) continue;

        const articles: Partial<Record<Site, string>> = {};
        for (const site of SITES)
          articles[site] = titleFromUrl(row[site]?.value);

        out.set(qid, {
          articles,
          commonsCategory: row.cat?.value,
          logoFile: titleFromUrl(row.logo?.value),
        });
      }
    }

    return out;
  }

  // ─── 2. Vikipedi bilgi kutularından aday dosyalar ──────────────────────────

  /**
   * @param titles kulüp kimliği → makale başlığı
   * @param extract wikitext'ten dosya adı çıkaran saf işlev
   * @returns kulüp kimliği → dosya adı
   */
  async fetchCandidates(
    site: Site,
    titles: ReadonlyMap<string, string>,
    extract: (wikitext: string) => string | null,
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

      const data = await this.#wiki(site).getJson(url, WikitextSchema, {
        label: `crest-${site}-${index}-${batch.length}`,
        describe: (v) => `${v.query?.pages?.length ?? 0} sayfa`,
      });

      const backTo = backwardMap(data.query ?? {});

      for (const page of data.query?.pages ?? []) {
        const content = page.revisions?.[0]?.slots?.main?.content;
        if (content === undefined) continue;

        const clubId = byTitle.get(originalTitle(page.title, backTo));
        if (clubId === undefined) continue;

        const file = extract(content);
        if (file !== null) out.set(clubId, file);
      }
    }

    return out;
  }

  // ─── 3. Künye ─────────────────────────────────────────────────────────────

  /**
   * Commons künyesi.
   *
   * `redirects=1` GEREKLİ: Commons'ta dosya yeniden adlandırıldığında eski ad
   * yönlendirme olarak kalır ve bilgi kutuları uzun süre eski adı taşır.
   * Yönlendirme izlenmezse o dosyalar "Commons'ta yok" sanılır — ölçüldü.
   */
  async fetchCommonsMetadata(
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
        redirects: "1",
        titles: batch.map((f) => `File:${f}`).join("|"),
      }).toString();

      const data = await this.#commons.getJson(url, ImageInfoSchema, {
        label: `crest-meta-r-${index}-${batch.length}`,
        describe: (v) => `${v.query?.pages?.length ?? 0} dosya`,
      });

      const backTo = backwardMap(data.query ?? {});

      for (const page of data.query?.pages ?? []) {
        const meta = page.imageinfo?.[0]?.extmetadata;
        const value: FileMetadata = {
          existsOnCommons: page.missing !== true && meta !== undefined,
          licenseShortName: metaString(meta, "LicenseShortName"),
          artist: metaString(meta, "Artist"),
          attributionRequired:
            metaString(meta, "AttributionRequired") === "true",
          nonFree: metaString(meta, "NonFree") === "true",
        };

        // Hem sorulan hem ulaşılan ad altında saklanır: çağıran sorduğu adla
        // arar, ama künye yönlendirme HEDEFİNE aittir.
        out.set(stripNamespace(page.title), value);
        out.set(stripNamespace(originalTitle(page.title, backTo)), value);
      }
    }

    return out;
  }

  /**
   * YEREL viki künyesi — denetim için (§4.3.1).
   *
   * Commons'ta bulunmayan bir dosyanın telifli OLDUĞUNU göstermez; nerede
   * durduğunu ve nasıl etiketlendiğini gösterir. `imagerepository` alanı
   * ayırt edicidir: `shared` dosyanın aslında Commons'ta olduğu anlamına gelir.
   */
  async fetchLocalMetadata(
    site: Site,
    files: readonly string[],
  ): Promise<Map<string, LocalFileMetadata>> {
    const out = new Map<string, LocalFileMetadata>();

    for (const [index, batch] of batches(
      [...new Set(files)],
      TITLE_BATCH,
    ).entries()) {
      const url = new URL(`https://${site}.wikipedia.org/w/api.php`);
      url.search = new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        prop: "imageinfo",
        iiprop: "extmetadata",
        redirects: "1",
        titles: batch.map((f) => `File:${f}`).join("|"),
      }).toString();

      const data = await this.#wiki(site).getJson(url, ImageInfoSchema, {
        label: `crest-local-${site}-${index}-${batch.length}`,
        describe: (v) => `${v.query?.pages?.length ?? 0} dosya`,
      });

      const backTo = backwardMap(data.query ?? {});

      for (const page of data.query?.pages ?? []) {
        const meta = page.imageinfo?.[0]?.extmetadata;
        const value: LocalFileMetadata = {
          exists: page.missing !== true && meta !== undefined,
          onCommons: page.imagerepository === "shared",
          licenseShortName: metaString(meta, "LicenseShortName"),
          license: metaString(meta, "License"),
          usageTerms: metaString(meta, "UsageTerms"),
          artist: metaString(meta, "Artist"),
          attributionRequired:
            metaString(meta, "AttributionRequired") === "true",
          nonFree: metaString(meta, "NonFree") === "true",
          copyrighted: metaString(meta, "Copyrighted"),
          restrictions: metaString(meta, "Restrictions"),
        };

        out.set(stripNamespace(page.title), value);
        out.set(stripNamespace(originalTitle(page.title, backTo)), value);
      }
    }

    return out;
  }

  // ─── 4. Commons kategorisi (son çare) ─────────────────────────────────────

  async fetchCategoryFiles(category: string): Promise<string[]> {
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

    const data = await this.#commons.getJson(url, CategorySchema, {
      label: `crest-cat-${category.slice(0, 40)}`,
      describe: (v) => `${v.query?.categorymembers?.length ?? 0} dosya`,
    });

    return (data.query?.categorymembers ?? []).map((m) =>
      stripNamespace(m.title),
    );
  }
}
