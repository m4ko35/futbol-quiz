import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { EtlConfig } from "../../config";
import { SparqlResponseSchema, type SparqlBinding } from "./schemas";

/**
 * Wikidata SPARQL istemcisi.
 *
 * ÖNEMLİ: Bu modül yalnızca ETL sürecinde kullanılır. Bir istek yolundan
 * (route handler, sayfa, servis) çağrılması PROJECT.md §7.4'ün ihlalidir —
 * uygulama çalışma zamanında hiçbir dış servise bağlanmaz.
 *
 * Üç davranış Wikidata'nın gerçek koşullarından doğdu:
 *   1. Hız sınırlama — istekler arasında en az bir aralık bırakılır.
 *   2. Yeniden deneme — geliştirme sırasında ağır sorgular 502 döndürdü;
 *      bunlar geçici hatalardır ve geri çekilerek tekrar denenmelidir.
 *   3. Disk önbelleği — aynı sorguyu tekrar tekrar çekmek hem yavaş hem
 *      kaba. Önbellek `.cache/` altında tutulur ve git'e girmez.
 */

/** Geçici sayılan ve yeniden denenen HTTP kodları. */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const MAX_ATTEMPTS = 6;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const REQUEST_TIMEOUT_MS = 90_000;

export interface QueryOptions {
  /** İnsan tarafından okunabilir etiket — log ve önbellek adı için. */
  readonly label: string;
  /** Önbelleği atlayıp taze veri çeker. */
  readonly noCache?: boolean;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class WikidataClient {
  readonly #config: EtlConfig;
  readonly #cacheDir: string;
  readonly #minIntervalMs: number;

  /** Bir önceki isteğin tamamlanma anı — hız sınırlaması buna dayanır. */
  #lastRequestAt = 0;
  /** İstekleri sıraya alır; eşzamanlı çağrı hız sınırını delmesin diye. */
  #queue: Promise<unknown> = Promise.resolve();

  constructor(config: EtlConfig, cacheDir: string) {
    this.#config = config;
    this.#cacheDir = cacheDir;
    this.#minIntervalMs = Math.ceil(1000 / config.ETL_REQUESTS_PER_SECOND);
  }

  /**
   * SPARQL sorgusunu çalıştırır ve doğrulanmış bağlamaları döner.
   *
   * @throws sorgu {@link MAX_ATTEMPTS} denemede de başarısız olursa
   */
  async query(sparql: string, options: QueryOptions): Promise<SparqlBinding[]> {
    const cacheFile = this.#cachePath(sparql, options.label);

    if (options.noCache !== true) {
      const cached = await this.#readCache(cacheFile);
      if (cached !== undefined) {
        console.log(`  ⤷ önbellek: ${options.label}`);
        return cached;
      }
    }

    // Sıraya al: paralel çağrılar hız sınırını aşmasın.
    const run = this.#queue.then(() => this.#fetchWithRetry(sparql, options));
    // Hatayı yutuyoruz ki tek bir başarısızlık sırayı kilitlemesin; asıl
    // hata `run` üzerinden çağırana ulaşır.
    this.#queue = run.catch(() => undefined);

    const bindings = await run;
    await this.#writeCache(cacheFile, bindings);
    return bindings;
  }

  async #fetchWithRetry(
    sparql: string,
    options: QueryOptions,
  ): Promise<SparqlBinding[]> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await this.#respectRateLimit();

      try {
        return await this.#fetchOnce(sparql, options.label);
      } catch (error) {
        lastError = error;

        if (!isRetryable(error) || attempt === MAX_ATTEMPTS) break;

        const wait =
          error instanceof TransientError && error.retryAfterMs !== undefined
            ? error.retryAfterMs
            : backoffMs(attempt);

        console.warn(
          `  ⚠ ${options.label}: ${describeError(error)} — ` +
            `${Math.round(wait / 1000)} sn sonra yeniden denenecek ` +
            `(${attempt}/${MAX_ATTEMPTS - 1})`,
        );
        await sleep(wait);
      }
    }

    throw new Error(
      `Wikidata sorgusu başarısız (${options.label}): ${describeError(lastError)}`,
      { cause: lastError },
    );
  }

  async #fetchOnce(sparql: string, label: string): Promise<SparqlBinding[]> {
    const url = new URL(this.#config.WIKIDATA_SPARQL_ENDPOINT);
    url.searchParams.set("query", sparql);

    const startedAt = Date.now();
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": this.#config.ETL_USER_AGENT,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    this.#lastRequestAt = Date.now();

    if (!response.ok) {
      const body = (await response.text().catch(() => "")).slice(0, 200);

      if (RETRYABLE_STATUS.has(response.status)) {
        throw new TransientHttpError(
          response.status,
          body,
          parseRetryAfter(response.headers.get("retry-after")),
        );
      }
      throw new Error(`HTTP ${response.status}: ${body}`);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (error) {
      // Gövde yarıda kesilmiş veya boş gelmiş. Teknik olarak bu bir
      // SyntaxError'dır, ama KAYNAĞI program değil ağdır: bağlantı koptuğunda
      // veya uç nokta yük altında gövdeyi tamamlamadığında oluşur. Bu yüzden
      // geçici hata olarak sarılır — Faz 1'de tam çekim tam bu yüzden
      // 191 grubun 123'ünde durdu.
      throw new TransientResponseError(
        `yanıt gövdesi okunamadı: ${describeError(error)}`,
      );
    }

    // Yanıt şemamıza uymuyorsa devam etmek yerine hemen dururuz (§2.3).
    const parsed = SparqlResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(
        `Wikidata yanıtı beklenen şemaya uymuyor: ${parsed.error.issues[0]?.message ?? "bilinmeyen"}`,
      );
    }

    const bindings = parsed.data.results.bindings;
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`  ⤷ ${label}: ${bindings.length} satır (${seconds} sn)`);

    return bindings;
  }

  async #respectRateLimit(): Promise<void> {
    const elapsed = Date.now() - this.#lastRequestAt;
    if (elapsed < this.#minIntervalMs) {
      await sleep(this.#minIntervalMs - elapsed);
    }
  }

  #cachePath(sparql: string, label: string): string {
    // Sorgunun kendisi anahtardır: sorgu değişirse önbellek kendiliğinden
    // geçersiz olur. Etiket yalnızca dosyayı insan gözüyle bulmak için.
    const hash = createHash("sha256").update(sparql).digest("hex").slice(0, 16);
    const safeLabel = label.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60);
    return path.join(this.#cacheDir, `${safeLabel}.${hash}.json`);
  }

  async #readCache(file: string): Promise<SparqlBinding[] | undefined> {
    try {
      const raw = await readFile(file, "utf8");
      const parsed = SparqlResponseSchema.shape.results.safeParse(
        JSON.parse(raw),
      );
      return parsed.success ? parsed.data.bindings : undefined;
    } catch {
      // Önbellek yoksa veya bozuksa yeniden çekilir — hata değil.
      return undefined;
    }
  }

  async #writeCache(file: string, bindings: SparqlBinding[]): Promise<void> {
    try {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify({ bindings }), "utf8");
    } catch (error) {
      // Önbellek yazılamazsa iş durmaz, sadece yavaşlar.
      console.warn(`  ⚠ önbellek yazılamadı: ${describeError(error)}`);
    }
  }
}

/**
 * Hata geçici mi, yoksa tekrar denemenin anlamı yok mu?
 *
 * Bu sınıflandırma Faz 1'de tam çekimi İKİ KEZ çökertti; o yüzden ayrı bir
 * fonksiyona alınıp testle kilitlendi. Öğrenilen ders şu: karar hatanın
 * TİPİNE değil, KAYNAĞINA göre verilmeli.
 *
 *   1. `AbortSignal.timeout()` bir `DOMException` fırlatır, adı
 *      `TimeoutError`'dır — `TypeError` değil. Kalıcı hata sanıldı, süreç
 *      191 grubun 23'ünde durdu.
 *   2. Yarıda kesilen yanıt gövdesi `SyntaxError` fırlatır. Tip olarak bir
 *      program hatasıdır ama kaynağı ağdır. Yine kalıcı sanıldı, süreç
 *      123. grupta durdu. Çözüm: gövde ayrıştırması `TransientResponseError`
 *      ile sarıldı — sınıflandırma artık tipe değil, hatanın oluştuğu yere
 *      bakıyor.
 */
export function isRetryable(error: unknown): boolean {
  // Ağ/uç nokta kaynaklı olduğunu bildiğimiz hatalar.
  if (error instanceof TransientError) return true;

  // Node'un fetch'i ağ katmanı hatalarını (DNS, bağlantı kopması) TypeError
  // olarak sarar.
  if (error instanceof TypeError) return true;

  // AbortSignal.timeout() → DOMException("TimeoutError")
  // Elle iptal          → DOMException("AbortError")
  // DOMException Node'da Error'dan türer, bu yüzden ada bakmak yeterli.
  if (error instanceof Error) {
    return error.name === "TimeoutError" || error.name === "AbortError";
  }

  return false;
}

/** Ağ veya uç nokta kaynaklı, yeniden denenmeye değer hata. */
export abstract class TransientError extends Error {
  /** Sunucu `Retry-After` bildirmişse bekleme süresi. */
  abstract readonly retryAfterMs: number | undefined;
}

/** Geçici sayılan HTTP durum kodu (429, 5xx). */
export class TransientHttpError extends TransientError {
  override readonly retryAfterMs: number | undefined;

  constructor(
    readonly status: number,
    readonly body: string,
    retryAfterMs: number | undefined,
  ) {
    super(`HTTP ${status}`);
    this.name = "TransientHttpError";
    this.retryAfterMs = retryAfterMs;
  }
}

/** Yanıt gövdesi eksik/bozuk geldi (bağlantı koptu, uç nokta yük altında). */
export class TransientResponseError extends TransientError {
  override readonly retryAfterMs = undefined;

  constructor(message: string) {
    super(message);
    this.name = "TransientResponseError";
  }
}

/** Üstel geri çekilme + jitter (aynı anda dönen işler senkron vurmasın). */
function backoffMs(attempt: number): number {
  const exponential = BASE_BACKOFF_MS * 2 ** (attempt - 1);
  const jitter = Math.random() * BASE_BACKOFF_MS;
  return Math.min(exponential + jitter, MAX_BACKOFF_MS);
}

function parseRetryAfter(header: string | null): number | undefined {
  if (header === null) return undefined;

  const seconds = Number.parseInt(header, 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_BACKOFF_MS);
  }

  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.min(Math.max(date - Date.now(), 0), MAX_BACKOFF_MS);
  }
  return undefined;
}

function describeError(error: unknown): string {
  if (error instanceof TransientHttpError) {
    return `HTTP ${error.status}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
