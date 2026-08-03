import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ZodType } from "zod";

/**
 * ETL'in ortak JSON taşıma katmanı — hız sınırı, yeniden deneme, önbellek.
 *
 * ÖNEMLİ: Bu modül yalnızca ETL sürecinde kullanılır. Bir istek yolundan
 * (route handler, sayfa, servis) çağrılması PROJECT.md §7.4'ün ihlalidir.
 *
 * NEDEN ORTAK. Wikidata ve Vikipedi istemcileri aynı üç davranışa muhtaç ve
 * bu davranışların en incesi — hangi hatanın yeniden denenebilir olduğu — tam
 * çekimi İKİ KEZ çökertti (bkz. `isRetryable`). O sınıflandırmanın iki
 * kopyası olsaydı, düzeltme yalnızca birine uygulanır ve arıza ikinci
 * kaynakta aynen tekrarlanırdı.
 *
 * Her istemci KENDİ örneğini kurar: hız sınırı sunucu başınadır ve Wikidata
 * ile Vikipedi ayrı sunuculardır.
 */

/** Geçici sayılan ve yeniden denenen HTTP kodları. */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const MAX_ATTEMPTS = 6;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const REQUEST_TIMEOUT_MS = 90_000;

export interface JsonClientOptions {
  /** Wikimedia kimliksiz istemcileri engeller; iletişim adresi içermeli. */
  readonly userAgent: string;
  readonly requestsPerSecond: number;
  readonly cacheDir: string;
  /** Uç noktanın beklediği içerik türü; verilmezse gönderilmez. */
  readonly accept?: string;
}

export interface JsonRequest<T> {
  /** İnsan tarafından okunabilir etiket — log ve önbellek dosya adı için. */
  readonly label: string;
  /**
   * Önbellek anahtarını belirleyen dize; verilmezse URL'in kendisi kullanılır.
   *
   * Wikidata bunu SPARQL metniyle geçersiz kılar: sorgunun kendisi anahtar
   * olunca sorgu değiştiği anda önbellek kendiliğinden geçersiz olur.
   */
  readonly cacheKey?: string;
  readonly noCache?: boolean;
  /**
   * Log satırına eklenen kısa özet (ör. satır sayısı).
   *
   * DOĞRULANMIŞ değeri alır, ham JSON'u değil — böylece özet yazmak için tip
   * dönüştürmeye gerek kalmaz (§2.5).
   */
  readonly describe?: (value: T) => string;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class JsonHttpClient {
  readonly #options: JsonClientOptions;
  readonly #minIntervalMs: number;

  /** Bir önceki isteğin tamamlanma anı — hız sınırlaması buna dayanır. */
  #lastRequestAt = 0;
  /** İstekleri sıraya alır; eşzamanlı çağrı hız sınırını delmesin diye. */
  #queue: Promise<unknown> = Promise.resolve();

  constructor(options: JsonClientOptions) {
    this.#options = options;
    this.#minIntervalMs = Math.ceil(1000 / options.requestsPerSecond);
  }

  /**
   * URL'i çeker, yanıtı şemayla doğrular ve döner.
   *
   * DOĞRULAMA ÖNBELLEKTEN OKURKEN DE YAPILIR (§2.3): önbellek dosyası diskte
   * duran, elle düzenlenebilen bir girdidir; ayrıcalıklı sayılamaz.
   *
   * @throws istek {@link MAX_ATTEMPTS} denemede de başarısız olursa
   */
  async getJson<T>(
    url: URL,
    schema: ZodType<T>,
    request: JsonRequest<T>,
  ): Promise<T> {
    const cacheFile = this.#cachePath(
      request.cacheKey ?? url.toString(),
      request.label,
    );

    if (request.noCache !== true) {
      const cached = await this.#readCache(cacheFile, schema);
      if (cached !== undefined) {
        console.log(`  ⤷ önbellek: ${request.label}`);
        return cached;
      }
    }

    // Sıraya al: paralel çağrılar hız sınırını aşmasın.
    const run = this.#queue.then(() =>
      this.#fetchWithRetry(url, schema, request),
    );
    // Hatayı yutuyoruz ki tek bir başarısızlık sırayı kilitlemesin; asıl
    // hata `run` üzerinden çağırana ulaşır.
    this.#queue = run.catch(() => undefined);

    const value = await run;
    await this.#writeCache(cacheFile, value);
    return value;
  }

  async #fetchWithRetry<T>(
    url: URL,
    schema: ZodType<T>,
    request: JsonRequest<T>,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await this.#respectRateLimit();

      try {
        return await this.#fetchOnce(url, schema, request);
      } catch (error) {
        lastError = error;

        if (!isRetryable(error) || attempt === MAX_ATTEMPTS) break;

        const wait =
          error instanceof TransientError && error.retryAfterMs !== undefined
            ? error.retryAfterMs
            : backoffMs(attempt);

        console.warn(
          `  ⚠ ${request.label}: ${describeError(error)} — ` +
            `${Math.round(wait / 1000)} sn sonra yeniden denenecek ` +
            `(${attempt}/${MAX_ATTEMPTS - 1})`,
        );
        await sleep(wait);
      }
    }

    throw new Error(
      `İstek başarısız (${request.label}): ${describeError(lastError)}`,
      { cause: lastError },
    );
  }

  async #fetchOnce<T>(
    url: URL,
    schema: ZodType<T>,
    request: JsonRequest<T>,
  ): Promise<T> {
    const startedAt = Date.now();
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...(this.#options.accept === undefined
          ? {}
          : { Accept: this.#options.accept }),
        "User-Agent": this.#options.userAgent,
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
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new Error(
        `Yanıt beklenen şemaya uymuyor (${request.label}): ` +
          `${parsed.error.issues[0]?.message ?? "bilinmeyen"}`,
      );
    }

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    const summary = request.describe?.(parsed.data);
    console.log(
      `  ⤷ ${request.label}: ${summary === undefined ? "" : `${summary} `}(${seconds} sn)`,
    );

    return parsed.data;
  }

  async #respectRateLimit(): Promise<void> {
    const elapsed = Date.now() - this.#lastRequestAt;
    if (elapsed < this.#minIntervalMs) {
      await sleep(this.#minIntervalMs - elapsed);
    }
  }

  #cachePath(key: string, label: string): string {
    const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
    const safeLabel = label.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60);
    return path.join(this.#options.cacheDir, `${safeLabel}.${hash}.json`);
  }

  async #readCache<T>(
    file: string,
    schema: ZodType<T>,
  ): Promise<T | undefined> {
    try {
      const parsed = schema.safeParse(JSON.parse(await readFile(file, "utf8")));
      return parsed.success ? parsed.data : undefined;
    } catch {
      // Önbellek yoksa veya bozuksa yeniden çekilir — hata değil.
      return undefined;
    }
  }

  async #writeCache(file: string, value: unknown): Promise<void> {
    try {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify(value), "utf8");
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

export function describeError(error: unknown): string {
  if (error instanceof TransientHttpError) {
    return `HTTP ${error.status}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
