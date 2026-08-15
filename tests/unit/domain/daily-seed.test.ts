import { describe, expect, it } from "vitest";
import {
  createRandom,
  dailySeed,
  nextRollover,
  seedVariant,
  shuffled,
} from "@/domain/value-objects/daily-seed";

/** §9.1 BR-11 — günlük ızgara deterministiktir. */

describe("dailySeed — BR-49, gün Türkiye saatiyle 06:00'da döner", () => {
  /**
   * SINIRIN İKİ YANI. 06:00 Türkiye = 03:00 UTC; bir saniye öncesi hâlâ
   * dünkü bulmacadır. Kural bir ürün kararıdır (§11): eski sınır UTC gece
   * yarısıydı ve Türkiye'de 03:00'e denk geliyordu, yani gece yarısı oynayan
   * kullanıcı "dünkü" bulmacada kalıyordu.
   */
  it("sınırın bir saniye ÖNCESİ hâlâ önceki gündür", () => {
    expect(dailySeed(new Date("2026-08-15T02:59:59Z"))).toBe(20260814);
  });

  it("sınırın kendisi yeni gündür", () => {
    expect(dailySeed(new Date("2026-08-15T03:00:00Z"))).toBe(20260815);
  });

  it("UTC gece yarısı gün DEĞİŞTİRMEZ", () => {
    // Eski davranışın tam tersi; bu test o davranışın geri gelmesini tutar.
    expect(dailySeed(new Date("2026-08-15T00:00:00Z"))).toBe(20260814);
  });

  it("bir bulmaca günü tam 24 saat sürer", () => {
    const basla = dailySeed(new Date("2026-08-15T03:00:00Z"));
    const bit = dailySeed(new Date("2026-08-16T02:59:59Z"));

    expect(basla).toBe(bit);
    expect(dailySeed(new Date("2026-08-16T03:00:00Z"))).not.toBe(basla);
  });

  /**
   * Sunucunun yerel dilimi bir dağıtım tesadüfüdür. Sabitlenmeseydi ızgara,
   * hangi bölgedeki sunucunun yanıt verdiğine göre değişirdi (BR-11).
   */
  it("aynı ANIN farklı gösterimleri aynı tohumu verir", () => {
    expect(dailySeed(new Date("2026-08-15T12:00:00+03:00"))).toBe(
      dailySeed(new Date("2026-08-15T09:00:00Z")),
    );
  });

  it("ay, yıl ve artık gün sınırlarını doğru geçer", () => {
    // Türkiye saatiyle 05:00, yani hâlâ önceki gün.
    expect(dailySeed(new Date("2026-01-01T02:00:00Z"))).toBe(20251231);
    expect(dailySeed(new Date("2026-03-01T02:00:00Z"))).toBe(20260228);
    expect(dailySeed(new Date("2028-03-01T02:00:00Z"))).toBe(20280229);
  });

  it("YYYYMMDD biçimindedir", () => {
    expect(dailySeed(new Date("2026-07-31T12:00:00Z"))).toBe(20260731);
  });
});

/**
 * §11.7 — ölçülen önbellek kusurunun onarımı.
 *
 * Günlük uçlar `s-maxage=86400` alıyordu ve o sürenin gerekçesi futbol
 * verisine aitti. Günlük bulmaca her gün değişiyor ve arada dağıtım yok;
 * sabah 10:00'da önbelleğe giren yanıt gün sınırını 24 saate kadar aşıyordu.
 */
describe("nextRollover", () => {
  it("sınırdan ÖNCE aynı günün sınırını verir", () => {
    expect(nextRollover(new Date("2026-08-15T02:00:00Z")).toISOString()).toBe(
      "2026-08-15T03:00:00.000Z",
    );
  });

  it("sınırdan SONRA ertesi günün sınırını verir", () => {
    expect(nextRollover(new Date("2026-08-15T12:00:00Z")).toISOString()).toBe(
      "2026-08-16T03:00:00.000Z",
    );
  });

  it("sınırın TAM ÜSTÜNDE bir sonraki güne geçer", () => {
    // Aksi hâlde süre 0 kalır ve yanıt hiç önbelleklenemezdi.
    expect(nextRollover(new Date("2026-08-15T03:00:00Z")).toISOString()).toBe(
      "2026-08-16T03:00:00.000Z",
    );
  });

  it("dönüş anı, o anın tohumunu DEĞİŞTİREN ilk andır", () => {
    // İki fonksiyonun aynı sınırı gördüğünü tutar; ayrışırlarsa önbellek
    // bayat bulmaca servis eder ve bunu kimse fark etmez.
    const simdi = new Date("2026-08-15T12:00:00Z");
    const sinir = nextRollover(simdi);

    expect(dailySeed(new Date(sinir.getTime() - 1))).toBe(dailySeed(simdi));
    expect(dailySeed(sinir)).not.toBe(dailySeed(simdi));
  });
});

describe("seedVariant", () => {
  it("her deneme farklı tohum üretir", () => {
    const base = 20260731;
    const seen = new Set(
      Array.from({ length: 40 }, (_, i) => seedVariant(base, i)),
    );
    expect(seen.size).toBe(40);
  });

  it("farklı günlerin denemeleri çakışmaz", () => {
    expect(seedVariant(20260731, 0)).not.toBe(seedVariant(20260801, 0));
  });
});

describe("createRandom", () => {
  it("aynı tohum aynı diziyi verir", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const first = Array.from({ length: 20 }, () => a());
    const second = Array.from({ length: 20 }, () => b());

    expect(first).toEqual(second);
  });

  it("farklı tohum farklı dizi verir", () => {
    const a = createRandom(1);
    const b = createRandom(2);
    expect(a()).not.toBe(b());
  });

  it("[0, 1) aralığında kalır", () => {
    const random = createRandom(20260731);
    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("shuffled", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("aynı tohumla aynı sırayı verir", () => {
    expect(shuffled(items, createRandom(7))).toEqual(
      shuffled(items, createRandom(7)),
    );
  });

  /**
   * Girdi değişseydi üretim denemeleri arasında havuz kayardı ve ikinci deneme
   * birincinin bıraktığı sıradan başlardı — determinizm bozulurdu.
   */
  it("girdiyi DEĞİŞTİRMEZ", () => {
    const original = [...items];
    shuffled(items, createRandom(7));
    expect(items).toEqual(original);
  });

  it("tüm öğeleri korur", () => {
    expect([...shuffled(items, createRandom(3))].sort((a, b) => a - b)).toEqual(
      items,
    );
  });

  it("boş diziyle çalışır", () => {
    expect(shuffled([], createRandom(1))).toEqual([]);
  });
});
