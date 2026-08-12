import type { EtlConfig } from "../../config";
import { JsonHttpClient, TransientError } from "../http";
import { SparqlResponseSchema, type SparqlBinding } from "./schemas";

/**
 * Wikidata SPARQL istemcisi.
 *
 * Hız sınırı, yeniden deneme ve disk önbelleği ortak taşıma katmanından gelir
 * (`../http.ts`); burada yalnızca SPARQL'e özgü olan kalır: uç noktanın
 * beklediği içerik türü ve önbelleğin SORGUYA göre anahtarlanması.
 */

export interface QueryOptions {
  /** İnsan tarafından okunabilir etiket — log ve önbellek adı için. */
  readonly label: string;
  /** Önbelleği atlayıp taze veri çeker. */
  readonly noCache?: boolean;
}

export class WikidataClient {
  readonly #endpoint: string;
  readonly #http: JsonHttpClient;

  constructor(config: EtlConfig, cacheDir: string) {
    this.#endpoint = config.WIKIDATA_SPARQL_ENDPOINT;
    this.#http = new JsonHttpClient({
      userAgent: config.ETL_USER_AGENT,
      requestsPerSecond: config.ETL_REQUESTS_PER_SECOND,
      cacheDir,
      accept: "application/sparql-results+json",
    });
  }

  /**
   * SPARQL sorgusunu çalıştırır ve doğrulanmış bağlamaları döner.
   *
   * @throws sorgu birkaç denemede de başarısız olursa
   */
  async query(sparql: string, options: QueryOptions): Promise<SparqlBinding[]> {
    const url = new URL(this.#endpoint);
    url.searchParams.set("query", sparql);

    const response = await this.#http.getJson(url, SparqlResponseSchema, {
      label: options.label,
      // SORGUNUN KENDİSİ ANAHTARDIR: sorgu değişirse önbellek kendiliğinden
      // geçersiz olur. URL'i anahtar yapmak da aynı sonucu verirdi, ama
      // uç nokta adresi değişince tüm önbellek boşuna atılırdı.
      cacheKey: sparql,
      noCache: options.noCache ?? false,
      describe: (value) => `${value.results.bindings.length} satır`,
    });

    return response.results.bindings;
  }

  /**
   * Bir kimlik grubunu sorar; sorgu uç noktada tükenirse grubu İKİYE BÖLÜP
   * yeniden dener — PROJECT.md §8.3.
   *
   * NEDEN BÖLME, GRUP BOYUTUNU KÜÇÜLTMEK DEĞİL. Ölçüldü (12 Ağustos 2026):
   * 308. oyuncu grubu iki ayrı koşuda, 45 dakika arayla, sekizer denemede
   * `HTTP 504` verdi. `504` ağ geçidi zaman aşımıdır: sorgu Wikidata'nın
   * kendi süre sınırını aşıyor, yani yük dalgalanması değil o sorgunun
   * maliyeti. Grup boyutunu global olarak düşürmek de çözerdi ama iki
   * bedeli var: her koşuda iki kat istek, ve — asıl önemlisi — ÖNBELLEĞİN
   * TAMAMI GEÇERSİZ OLURDU, çünkü anahtar sorgu metnidir. Bölme yalnızca
   * düşen grubu etkiler; diğerlerinin sorgusu değişmediği için önbellekleri
   * korunur.
   *
   * ÜST DÜZEY ETİKET DEĞİŞTİRİLMEZ. Önbellek dosya adı etiketi de içeriyor;
   * etiketi değiştirmek var olan önbelleği görünmez kılardı. Yalnızca
   * bölünmüş alt gruplar yeni etiket alır — onlar zaten yeni sorgudur.
   *
   * YALNIZCA UÇ NOKTA KAYNAKLI hatada bölünür. Şema uyuşmazlığı gibi bir
   * kusur bölünerek çözülmez; küçülen gruplarla aynı hatayı tekrarlamak
   * gerçek sebebi gizlerdi.
   */
  async queryBatch(
    qids: readonly string[],
    build: (batch: readonly string[]) => string,
    options: QueryOptions,
  ): Promise<SparqlBinding[]> {
    try {
      return await this.query(build(qids), options);
    } catch (error) {
      if (qids.length <= MIN_SPLIT_SIZE || !isEndpointFailure(error))
        throw error;

      const mid = Math.ceil(qids.length / 2);
      console.warn(
        `  ⚠ ${options.label}: ${String(qids.length)} kimlik ikiye bölünüyor ` +
          `(${String(mid)} + ${String(qids.length - mid)})`,
      );

      const left = await this.queryBatch(qids.slice(0, mid), build, {
        ...options,
        label: `${options.label}-a`,
      });
      const right = await this.queryBatch(qids.slice(mid), build, {
        ...options,
        label: `${options.label}-b`,
      });

      return [...left, ...right];
    }
  }
}

/**
 * Bölmenin durduğu taban.
 *
 * Bu boyutun altında bir sorgunun uç noktayı zorlaması beklenmez; hata
 * ısrarla sürüyorsa sebebi büyüklük değildir ve bölmeye devam etmek gerçek
 * sebebi gizler.
 */
const MIN_SPLIT_SIZE = 25;

/**
 * Hata uç noktadan mı geldi?
 *
 * `#fetchWithRetry` denemeleri tükendiğinde son hatayı `cause` olarak
 * sarmalıyor; `TransientError` olması, sorunun ağ/uç nokta kaynaklı
 * olduğunu söyler (zaman aşımı, `5xx`, yarım gövde).
 */
function isEndpointFailure(error: unknown): boolean {
  return error instanceof Error && error.cause instanceof TransientError;
}
