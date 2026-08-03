import type { EtlConfig } from "../../config";
import { JsonHttpClient } from "../http";
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
}
