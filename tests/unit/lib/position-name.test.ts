import { describe, expect, it } from "vitest";
import { POSITIONS } from "../../../scripts/etl/pipeline/normalize";
import { knownPositionKeys, positionName } from "@/lib/position-name";

/** BR-40 — mevki anahtarı → Türkçe ad (§6.2). */

describe("positionName", () => {
  it("beş mevkiyi de çevirir", () => {
    expect(positionName("goalkeeper")).toBe("Kaleci");
    expect(positionName("defender")).toBe("Defans");
    expect(positionName("midfielder")).toBe("Orta saha");
    expect(positionName("winger")).toBe("Kanat");
    expect(positionName("forward")).toBe("Forvet");
  });

  it("`null` girdide `null` döner", () => {
    expect(positionName(null)).toBeNull();
  });

  /**
   * HAM ANAHTAR KULLANICIYA GÖSTERİLMEZ. `goalkeeper` dizgisini olduğu gibi
   * döndürmek, çevirinin unutulduğu yerleri SESSİZ kılardı; `null` dönmek
   * onları görünür yapar (§2.7 ile aynı yön).
   */
  it("tanınmayan anahtarda ham değeri GEÇİRMEZ", () => {
    expect(positionName("sweeper")).toBeNull();
    expect(positionName("Kaleci")).toBeNull();
    expect(positionName("")).toBeNull();
  });
});

/**
 * İKİ KÜME AYRI DOSYALARDA ve ayrı katmanlarda yaşıyor: `POSITIONS` ETL'in
 * ürettiği değerleri, `NAMES` arayüzün çevirebildiklerini tanımlıyor. Biri
 * büyüyüp diğeri büyümezse kusur SESSİZDİR — yeni mevki arayüzde boş görünür.
 * Bu test o sessizliği kaldırıyor.
 */
describe("küme uyumu — ETL ile arayüz", () => {
  it("ETL'in ürettiği HER değerin Türkçe karşılığı var", () => {
    const untranslatable = POSITIONS.filter(
      (key) => positionName(key) === null,
    );

    expect(untranslatable).toEqual([]);
  });

  it("arayüzün bildiği her anahtarı ETL gerçekten üretiyor", () => {
    // Ters yön: ölü çeviri satırı da bir kusurdur — kümenin daraldığını
    // kimse fark etmez.
    const orphans = knownPositionKeys().filter(
      (key) => !POSITIONS.includes(key),
    );

    expect(orphans).toEqual([]);
  });

  it("değerler DİLDEN BAĞIMSIZ — Türkçe karakter taşımaz", () => {
    // Kuralın kendisi (BR-40): veri katmanına dile bağlı değer yazılmaz.
    for (const key of POSITIONS) {
      expect(key).toMatch(/^[a-z]+$/u);
    }
  });
});
