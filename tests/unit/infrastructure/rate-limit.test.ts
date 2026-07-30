import { describe, expect, it } from "vitest";
import {
  resolveClientKey,
  SHARED_KEY,
} from "@/infrastructure/rate-limit/client-key";
import { TokenBucketRateLimiter } from "@/infrastructure/rate-limit/token-bucket";

/** §7.5 — istek hızı sınırlama. */

/** Kontrol edilebilir saat: gerçek zamana bağlı test kırılgan olurdu. */
function clock(startMs = 1_000_000) {
  let now = startMs;
  return {
    now: () => now,
    advance(ms: number) {
      now += ms;
    },
  };
}

describe("TokenBucketRateLimiter", () => {
  it("patlama toleransı kadar isteğe arka arkaya izin verir", () => {
    const limiter = new TokenBucketRateLimiter({
      requestsPerMinute: 60,
      burst: 10,
      now: clock().now,
    });

    for (let i = 0; i < 10; i++) {
      expect(limiter.check("ip"), `${i}. istek`).toMatchObject({
        allowed: true,
      });
    }
    expect(limiter.check("ip").allowed).toBe(false);
  });

  it("aşımda Retry-After için en az 1 saniye verir", () => {
    const limiter = new TokenBucketRateLimiter({
      requestsPerMinute: 60,
      burst: 1,
      now: clock().now,
    });

    limiter.check("ip");
    const denied = limiter.check("ip");

    expect(denied.allowed).toBe(false);
    // Aşağı yuvarlansaydı 0 çıkar ve istemciye "hemen tekrar dene" denirdi.
    expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("zaman ilerledikçe jeton doldurur", () => {
    const time = clock();
    const limiter = new TokenBucketRateLimiter({
      requestsPerMinute: 60,
      burst: 2,
      now: time.now,
    });

    limiter.check("ip");
    limiter.check("ip");
    expect(limiter.check("ip").allowed).toBe(false);

    // 60 istek/dakika = saniyede 1 jeton.
    time.advance(1000);
    expect(limiter.check("ip").allowed).toBe(true);
  });

  it("kova kapasitesinin üstüne jeton biriktirmez", () => {
    const time = clock();
    const limiter = new TokenBucketRateLimiter({
      requestsPerMinute: 60,
      burst: 3,
      now: time.now,
    });

    // Bir saat bekle: sınırsız birikim olsaydı 3600 jeton olurdu.
    time.advance(3_600_000);

    for (let i = 0; i < 3; i++) expect(limiter.check("ip").allowed).toBe(true);
    expect(limiter.check("ip").allowed).toBe(false);
  });

  it("anahtarları birbirinden bağımsız sayar", () => {
    const limiter = new TokenBucketRateLimiter({
      requestsPerMinute: 60,
      burst: 1,
      now: clock().now,
    });

    expect(limiter.check("ip-a").allowed).toBe(true);
    expect(limiter.check("ip-a").allowed).toBe(false);
    // Farklı istemci etkilenmemeli.
    expect(limiter.check("ip-b").allowed).toBe(true);
  });

  it("kova sayısı sınırlıdır — bellek tüketim saldırısına kapalı", () => {
    // §7.1: anahtar istemciden geliyor; sınırsız Map, sınırlayıcının kendisini
    // saldırı aracına çevirirdi.
    const limiter = new TokenBucketRateLimiter({
      requestsPerMinute: 60,
      burst: 5,
      now: clock().now,
      maxBuckets: 50,
    });

    for (let i = 0; i < 5000; i++) limiter.check(`ip-${i}`);

    // +1: ortak taşma kovası. Bellek baskısı altında yeni anahtarlar kendi
    // kovalarını almak yerine onu paylaşır, bu yüzden sınırın bir üstünde
    // sabitlenir — 5000 anahtar için 51 giriş.
    expect(limiter.size).toBeLessThanOrEqual(51);
  });

  it("bellek sınırına rağmen etkin istemciyi sınırlamayı sürdürür", () => {
    // Tahliye "dolu" kovaları atar; jetonunu tüketmiş bir istemcinin kovası
    // dolu değildir, dolayısıyla tahliyeyle kota kazanamaz.
    const limiter = new TokenBucketRateLimiter({
      requestsPerMinute: 60,
      burst: 2,
      now: clock().now,
      maxBuckets: 20,
    });

    limiter.check("kurban");
    limiter.check("kurban");
    expect(limiter.check("kurban").allowed).toBe(false);

    for (let i = 0; i < 200; i++) limiter.check(`gurultu-${i}`);

    expect(limiter.check("kurban").allowed).toBe(false);
  });

  it("geçersiz yapılandırmayı reddeder", () => {
    expect(
      () => new TokenBucketRateLimiter({ requestsPerMinute: 0, burst: 10 }),
    ).toThrow();
    expect(
      () => new TokenBucketRateLimiter({ requestsPerMinute: 60, burst: 0 }),
    ).toThrow();
  });
});

describe("resolveClientKey", () => {
  function headers(value?: string): Headers {
    const h = new Headers();
    if (value !== undefined) h.set("x-forwarded-for", value);
    return h;
  }

  it("tek vekil arkasında sondaki girişi alır", () => {
    // Kenar vekil kendi gördüğü adresi EKLER; soldaki değer istemcinin
    // uydurduğu olabilir.
    expect(resolveClientKey(headers("sahte, 203.0.113.7"), 1)).toBe(
      "203.0.113.7",
    );
  });

  it("iki vekil arkasında sondan ikinciyi alır", () => {
    expect(resolveClientKey(headers("sahte, 203.0.113.7, 10.0.0.1"), 2)).toBe(
      "203.0.113.7",
    );
  });

  it("istemcinin uydurduğu değeri ASLA kullanmaz", () => {
    const spoofed = resolveClientKey(
      headers("1.2.3.4, 5.6.7.8, 203.0.113.7"),
      1,
    );

    expect(spoofed).toBe("203.0.113.7");
    expect(spoofed).not.toBe("1.2.3.4");
  });

  it("vekil yokken başlığı tamamen yok sayar", () => {
    // Doğrudan internete açıkken XFF'e güvenmek sınırlamayı işlevsiz kılar:
    // saldırgan her istekte başka değer yazıp yeni kova alırdı.
    expect(resolveClientKey(headers("1.2.3.4"), 0)).toBe(SHARED_KEY);
  });

  it("başlık yoksa ortak anahtara düşer", () => {
    expect(resolveClientKey(headers(), 1)).toBe(SHARED_KEY);
  });

  it("beklenenden az giriş varsa uydurmaz, ortak anahtara düşer", () => {
    expect(resolveClientKey(headers("203.0.113.7"), 3)).toBe(SHARED_KEY);
  });

  it("boş ve boşluklu girişleri temizler", () => {
    expect(resolveClientKey(headers("  ,  , 203.0.113.7  "), 1)).toBe(
      "203.0.113.7",
    );
  });

  it("aşırı uzun değeri kırpar", () => {
    const key = resolveClientKey(headers("x".repeat(5000)), 1);

    expect(key.length).toBeLessThanOrEqual(64);
  });
});
