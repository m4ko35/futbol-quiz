import { z } from "zod";

import type { EtlConfig } from "../../config";
import { JsonHttpClient } from "../http";

/**
 * Vikipedi (MediaWiki) istemcisi — PROJECT.md §4.3.
 *
 * İki iş yapar, ikisi de toplu:
 *   1. Makale başlığı → wikitext      (`prop=revisions`)
 *   2. Kulüp makalesi → takma adları  (`prop=redirects`)
 *
 * MAKALE BAŞLIKLARI BURADAN GELMEZ. Varlık → makale eşlemesi SPARQL'den
 * alınır (`wikipediaArticles`): MediaWiki'nin uçları istek başına 50 kimlik
 * kabul ederken SPARQL 250 dönüyor ve sorgu zaten kurulmuş Wikidata
 * geçişine iliştiriliyor. Ölçüm: 76 bin oyuncuda 1.520 istek yerine 304.
 *
 * ÖNEMLİ: Yalnızca ETL'de kullanılır (§7.4).
 */

export type WikiSite = "tr" | "en";

/** Okunan diller. Sıra anlamlıdır — bkz. `wikipedia-pass.ts`. */
export const WIKI_SITES: readonly WikiSite[] = ["tr", "en"];

/**
 * Bir istekte sorulacak başlık sayısı.
 *
 * 50 MediaWiki'nin üst sınırı ve ÖLÇÜLDÜ: 50 başlıkla yanıt 0,75 MB ve
 * kesilmiyor (20 başlıkta 0,44 MB). İstek sayısı 2,5 kat azalırken süre
 * yalnızca 1,4 kat artıyor. Yine de kesilme ihtimaline karşı `continue`
 * izleniyor — sessiz eksik makale, "bilgi kutusu yok" gibi görünürdü.
 */
const TITLE_BATCH = 50;

/** Kesilmiş yanıtta izlenecek en fazla devam adımı. */
const MAX_CONTINUATIONS = 20;

/**
 * MediaWiki HATAYI HTTP 200 İLE DÖNER.
 *
 * Gövdede `error` alanı olur ve `query` hiç gelmez. Şema `query`'yi isteğe
 * bağlı tuttuğu için bu sessizce "sonuç yok" gibi görünürdü — yani veri kaybı
 * hata sanılmadan geçerdi (§2.7). Bu yüzden `error` açıkça okunur ve atılır.
 */
const ApiErrorSchema = z
  .object({ code: z.string(), info: z.string().optional() })
  .optional();

const TitleStepSchema = z.array(z.object({ from: z.string(), to: z.string() }));

const ContinueSchema = z
  .record(z.string(), z.union([z.string(), z.number()]))
  .optional();

const WikitextResponseSchema = z.object({
  error: ApiErrorSchema,
  continue: ContinueSchema,
  query: z
    .object({
      normalized: TitleStepSchema.optional(),
      redirects: TitleStepSchema.optional(),
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

const RedirectsResponseSchema = z.object({
  error: ApiErrorSchema,
  continue: ContinueSchema,
  query: z
    .object({
      normalized: TitleStepSchema.optional(),
      pages: z
        .array(
          z.object({
            title: z.string(),
            redirects: z.array(z.object({ title: z.string() })).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export interface FetchOptions {
  readonly noCache?: boolean;
}

/** Bir varlığın dil başına makale adı. */
export type ArticleTitles = Partial<Record<WikiSite, string>>;

/**
 * `https://tr.wikipedia.org/wiki/Sebastian_Rudy` → `Sebastian Rudy`
 *
 * SPARQL makale ADRESİ döner, adı değil. Adres yüzde kodlaması taşır
 * (`Abd%C3%BClkerim_Bardak%C3%A7%C4%B1`); çözülmezse hiçbir başlık eşleşmez.
 */
export function articleTitleFromUrl(url: string): string | null {
  const last = url.split("/").pop();
  if (last === undefined || last.length === 0) return null;

  try {
    return decodeURIComponent(last).replace(/_/gu, " ").trim();
  } catch {
    // Bozuk yüzde kodlaması — başlığı tahmin etmektense atlamak doğru.
    return null;
  }
}

export class WikipediaClient {
  readonly #config: EtlConfig;
  readonly #cacheDir: string;
  /** Sunucu başına ayrı istemci: hız sınırı SUNUCU başınadır. */
  readonly #clients = new Map<string, JsonHttpClient>();

  constructor(config: EtlConfig, cacheDir: string) {
    this.#config = config;
    this.#cacheDir = cacheDir;
  }

  #clientFor(site: WikiSite): JsonHttpClient {
    const existing = this.#clients.get(site);
    if (existing !== undefined) return existing;

    const client = new JsonHttpClient({
      userAgent: this.#config.ETL_USER_AGENT,
      requestsPerSecond: this.#config.ETL_REQUESTS_PER_SECOND,
      cacheDir: this.#cacheDir,
    });
    this.#clients.set(site, client);
    return client;
  }

  /**
   * Makale wikitext'ini GRUP GRUP akıtır.
   *
   * NEDEN TEK BİR MAP DÖNMÜYOR — ölçüldü. İngilizce Vikipedi'de ~59.000
   * oyuncu makalesi var ve ortalama boyut ~40 KB; hepsini biriktirmek
   * **~2,4 GB** demek (tek başına Harry Kane'in makalesi 289 KB). Metin
   * ayrıştırıldıktan sonra bir işe yaramıyor, o yüzden grup tüketilir
   * tüketilmez serbest bırakılır.
   *
   * Her grup, İSTENEN başlıkla anahtarlanır: MediaWiki başlığı normalleştirir
   * ya da yönlendirmeyi izler, dönen başlık istenenle aynı olmayabilir.
   * Çağıran elindeki başlıkla arayabilmeli.
   */
  async *articleWikitext(
    site: WikiSite,
    titles: readonly string[],
    options: FetchOptions = {},
  ): AsyncGenerator<Map<string, string>> {
    const unique = [...new Set(titles)];

    for (const [index, batch] of batches(unique, TITLE_BATCH).entries()) {
      const result = new Map<string, string>();

      for await (const data of this.#paged(
        site,
        {
          action: "query",
          format: "json",
          formatversion: "2",
          prop: "revisions",
          rvprop: "content",
          rvslots: "main",
          redirects: "1",
          titles: batch.join("|"),
        },
        WikitextResponseSchema,
        {
          label: `wp-${site}-text-${index}-${batch.length}`,
          noCache: options.noCache ?? false,
          describe: (v) => `${v.query?.pages?.length ?? 0} sayfa`,
        },
      )) {
        throwOnApiError(data.error, "prop=revisions");

        const aliases = aliasIndex([
          data.query?.normalized,
          data.query?.redirects,
        ]);
        for (const page of data.query?.pages ?? []) {
          const content = page.revisions?.[0]?.slots?.main?.content;
          if (content === undefined) continue;

          for (const name of originsOf(page.title, aliases)) {
            result.set(name, content);
          }
        }
      }

      yield result;
    }
  }

  /**
   * Verilen makalelere işaret eden yönlendirmeleri döner (`takma ad → asıl`).
   *
   * NEDEN GEREKLİ. Bilgi kutuları kulübe her adıyla bağlanıyor:
   * `[[Torku Konyaspor]]`, `[[Atiker Konyaspor]]`, `[[Konya SK]]` — üçü de
   * `Konyaspor`a yönlendirme. Takma adlar okunmazsa bu satırlar "çözülemedi"
   * diye atılırdı; ölçüldü, tek başına Konyaspor'un 5, Galatasaray'ın 11
   * takma adı var.
   */
  async redirectAliases(
    site: WikiSite,
    titles: readonly string[],
    options: FetchOptions = {},
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const unique = [...new Set(titles)];

    for (const [index, batch] of batches(unique, TITLE_BATCH).entries()) {
      for await (const data of this.#paged(
        site,
        {
          action: "query",
          format: "json",
          formatversion: "2",
          prop: "redirects",
          rdnamespace: "0",
          rdlimit: "500",
          titles: batch.join("|"),
        },
        RedirectsResponseSchema,
        {
          label: `wp-${site}-alias-${index}-${batch.length}`,
          noCache: options.noCache ?? false,
          describe: (v) =>
            `${(v.query?.pages ?? []).reduce((n, p) => n + (p.redirects?.length ?? 0), 0)} takma ad`,
        },
      )) {
        throwOnApiError(data.error, "prop=redirects");

        const aliases = aliasIndex([data.query?.normalized]);
        for (const page of data.query?.pages ?? []) {
          // İstenen başlık normalleştirilmiş olabilir; asıl ad olarak
          // çağıranın verdiği başlık kullanılır ki eşleştirme tutsun.
          const canonical = originsOf(page.title, aliases);
          for (const redirect of page.redirects ?? []) {
            for (const name of canonical) result.set(redirect.title, name);
          }
        }
      }
    }

    return result;
  }

  /**
   * `continue` alanını izleyerek kesilmiş yanıtları tamamlar.
   *
   * `prop=redirects` bunu gerçekten kullanır: 50 kulübün toplam yönlendirmesi
   * `rdlimit` sınırını aşabilir. Devamı izlemezsek kayıp SESSİZ olurdu.
   */
  async *#paged<T extends { continue?: Record<string, string | number> }>(
    site: WikiSite,
    params: Record<string, string>,
    schema: z.ZodType<T>,
    request: {
      label: string;
      noCache: boolean;
      describe: (value: T) => string;
    },
  ): AsyncGenerator<T> {
    let extra: Record<string, string> = {};

    for (let step = 0; step <= MAX_CONTINUATIONS; step++) {
      const url = new URL(`https://${site}.wikipedia.org/w/api.php`);
      url.search = new URLSearchParams({ ...params, ...extra }).toString();

      const data = await this.#clientFor(site).getJson(url, schema, {
        ...request,
        label: step === 0 ? request.label : `${request.label}+${step}`,
      });
      yield data;

      if (data.continue === undefined) return;
      extra = Object.fromEntries(
        Object.entries(data.continue).map(([k, v]) => [k, String(v)]),
      );
    }

    console.warn(
      `  ⚠ ${request.label}: ${MAX_CONTINUATIONS} devam adımı aşıldı, kalanı atlandı`,
    );
  }
}

function throwOnApiError(
  error: { code: string; info?: string } | undefined,
  what: string,
): void {
  if (error === undefined) return;

  throw new Error(
    `MediaWiki ${what} hatası: ${error.code}${error.info === undefined ? "" : ` — ${error.info}`}`,
  );
}

function batches<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * `hedef → [kaynak…]` dizini.
 *
 * MediaWiki iki adımda başlık değiştirebilir: önce normalleştirme
 * (`galatasaray` → `Galatasaray`), sonra yönlendirme. İkisi de kayıt altına
 * alınır ki sonuç, çağıranın elindeki ÖZGÜN başlıkla bulunabilsin.
 */
function aliasIndex(
  steps: readonly (readonly { from: string; to: string }[] | undefined)[],
): Map<string, string[]> {
  const index = new Map<string, string[]>();

  for (const list of steps) {
    for (const step of list ?? []) {
      index.set(step.to, [...(index.get(step.to) ?? []), step.from]);
    }
  }

  return index;
}

/**
 * Bir başlığın kendisi ve ona dönüşen tüm özgün başlıklar.
 *
 * Zincir geriye doğru izlenir; döngüye karşı görülenler kümesi tutulur —
 * Vikipedi'de yönlendirme döngüleri gerçekten var.
 */
function originsOf(title: string, aliases: Map<string, string[]>): string[] {
  const seen = new Set<string>([title]);
  const stack = [title];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;

    for (const origin of aliases.get(current) ?? []) {
      if (seen.has(origin)) continue;
      seen.add(origin);
      stack.push(origin);
    }
  }

  return [...seen];
}
