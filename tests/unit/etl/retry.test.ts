import { describe, expect, it } from "vitest";

import {
  isRetryable,
  TransientHttpError,
  TransientResponseError,
} from "../../../scripts/etl/sources/wikidata/client";

/**
 * Bu testler iki gerçek arızadan doğdu. Tam çekim iki kez, farklı sebeplerle
 * ama AYNI kök hatayla çöktü: yeniden deneme kararı hatanın TİPİNE bakılarak
 * veriliyordu, oysa KAYNAĞINA bakmalıydı.
 *
 *   1. 191 grubun 23'ünde: `AbortSignal.timeout()` bir DOMException
 *      ("TimeoutError") fırlatıyor, TypeError değil.
 *   2. 191 grubun 123'ünde: yarıda kesilen yanıt gövdesi SyntaxError
 *      fırlatıyor — tip olarak program hatası, kaynak olarak ağ hatası.
 */
describe("isRetryable", () => {
  it("geçici HTTP hatasını yeniden dener", () => {
    expect(isRetryable(new TransientHttpError(502, "", undefined))).toBe(true);
    expect(isRetryable(new TransientHttpError(429, "", 5000))).toBe(true);
  });

  it("eksik/bozuk yanıt gövdesini yeniden dener", () => {
    // "Unexpected end of JSON input" — bağlantı gövde tamamlanmadan koptu.
    // Bare SyntaxError yeniden denenmez (aşağıya bkz.), ama gövde
    // ayrıştırması istemcide bu sarmalayıcıya çevrilir.
    expect(
      isRetryable(new TransientResponseError("yanıt gövdesi okunamadı")),
    ).toBe(true);
  });

  it("istek zaman aşımını yeniden dener", () => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";

    expect(isRetryable(timeout)).toBe(true);
  });

  it("iptal edilmiş isteği yeniden dener", () => {
    const aborted = new Error("This operation was aborted");
    aborted.name = "AbortError";

    expect(isRetryable(aborted)).toBe(true);
  });

  it("ağ katmanı hatasını yeniden dener", () => {
    // Node'un fetch'i bağlantı/DNS hatalarını TypeError olarak sarar.
    expect(isRetryable(new TypeError("fetch failed"))).toBe(true);
  });

  it("gerçek AbortSignal zaman aşımı nesnesini tanır", () => {
    // Sentetik değil, çalışma zamanının ürettiği gerçek hata nesnesi.
    const signal = AbortSignal.timeout(0);
    return new Promise<void>((resolve) => {
      signal.addEventListener("abort", () => {
        expect(isRetryable(signal.reason)).toBe(true);
        resolve();
      });
    });
  });

  it("program hatalarını yeniden denemez", () => {
    // Sarmalanmamış SyntaxError kodumuzdaki bir hatadır; tekrar denemek
    // sonucu değiştirmez, yalnızca arızayı geciktirir.
    expect(isRetryable(new SyntaxError("bozuk JSON"))).toBe(false);
    expect(isRetryable(new Error("beklenmeyen"))).toBe(false);
    expect(isRetryable(new RangeError("aralık dışı"))).toBe(false);
  });

  it("Error olmayan değerleri yeniden denemez", () => {
    expect(isRetryable("bir metin")).toBe(false);
    expect(isRetryable(undefined)).toBe(false);
    expect(isRetryable(null)).toBe(false);
  });
});

describe("TransientError alt sınıfları", () => {
  it("HTTP hatası Retry-After süresini taşır", () => {
    expect(new TransientHttpError(429, "", 5000).retryAfterMs).toBe(5000);
    expect(new TransientHttpError(502, "", undefined).retryAfterMs).toBe(
      undefined,
    );
  });

  it("gövde hatasında Retry-After yoktur, geri çekilme kullanılır", () => {
    expect(new TransientResponseError("bozuk").retryAfterMs).toBe(undefined);
  });
});
