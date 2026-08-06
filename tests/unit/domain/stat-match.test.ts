import { describe, expect, it } from "vitest";
import {
  isPlayerAlreadyUsed,
  isRoundComplete,
  isScoped,
  isStatKey,
  scoreFor,
  SCORE_TOLERANCE_FACTOR,
  STAT_DEVIATIONS,
  STAT_KEYS,
  totalScore,
  type StatKey,
} from "@/domain/services/stat-match";

/** §9.2 — istatistik eşleştirme kuralları (BR-17, BR-18). */

describe("STAT_KEYS ve isStatKey", () => {
  it("altı istatistik tanımlar", () => {
    expect(STAT_KEYS).toHaveLength(6);
  });

  it("her anahtarın bir sapması vardır", () => {
    for (const key of STAT_KEYS) {
      expect(STAT_DEVIATIONS[key]).toBeGreaterThan(0);
    }
  });

  /** Anahtarlar API sözleşmesinin parçası; istemciden gelen metin denetlenir. */
  it("tanınmayan anahtarı reddeder", () => {
    expect(isStatKey("appearances")).toBe(true);
    expect(isStatKey("kupa")).toBe(false);
    expect(isStatKey("")).toBe(false);
    expect(isStatKey("__proto__")).toBe(false);
  });
});

describe("scoreFor — BR-18", () => {
  it("tam isabet 100 verir", () => {
    for (const key of STAT_KEYS) {
      expect(scoreFor(key, 100, 100)).toBe(100);
    }
  });

  it("iki standart sapma uzaklıkta 0 verir", () => {
    const target = 300;
    const away = SCORE_TOLERANCE_FACTOR * STAT_DEVIATIONS.appearances;

    expect(scoreFor("appearances", target, target + away)).toBe(0);
    expect(scoreFor("appearances", target, target - away)).toBe(0);
  });

  it("çok uzak tahminde negatife DÜŞMEZ", () => {
    expect(scoreFor("goals", 10, 100000)).toBe(0);
  });

  it("yön fark etmez — eksik ve fazla eşit cezalıdır", () => {
    expect(scoreFor("appearances", 200, 250)).toBe(
      scoreFor("appearances", 200, 150),
    );
  });

  /**
   * ORANSAL FORMÜL ÖLÇÜLEREK REDDEDİLDİ; iki ucu birden bozuyordu:
   *
   *                              oransal   bu formül (çarpan 2)
   *   400 maç hedef, 300 tahmin    %75            %53
   *     3 gol hedef,   8 tahmin     %0            %89
   *
   * Aşağıdaki iki test o iki ucun DOĞRU tarafta kaldığını sabitler: büyük
   * hedefteki büyük sapma oransal formülden daha az ödüllendirilir, küçük
   * hedefteki küçük mutlak sapma ise sıfırlanmaz.
   */
  it("büyük hedefte büyük sapmayı oransal formülden az ödüllendirir", () => {
    const oransal = 100 * (1 - 100 / 400); // = 75
    expect(scoreFor("appearances", 400, 300)).toBeLessThan(oransal);
  });

  it("küçük hedefte küçük mutlak sapmayı cezalandırmaz", () => {
    // Oransal formül burada %0 verirdi (5 sapma, 3 hedef).
    expect(scoreFor("goals", 3, 8)).toBeGreaterThan(80);
  });

  /**
   * Aynı GÖRECELİ hata farklı ölçeklerde benzer puan almalı — formülün amacı
   * tam olarak bu.
   */
  it("ölçekten bağımsızdır", () => {
    const yariSapmaMac = STAT_DEVIATIONS.appearances / 2;
    const yariSapmaBoy = STAT_DEVIATIONS.heightCm / 2;

    expect(scoreFor("appearances", 200, 200 + yariSapmaMac)).toBe(
      scoreFor("heightCm", 180, 180 + yariSapmaBoy),
    );
  });

  it("0–100 aralığında tam sayı döner", () => {
    for (const key of STAT_KEYS) {
      for (const chosen of [0, 1, 7, 55, 180, 999]) {
        const score = scoreFor(key, 100, chosen);
        expect(Number.isInteger(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("totalScore", () => {
  it("seçimlerin ortalamasını verir", () => {
    expect(totalScore([100, 50, 0])).toBe(50);
  });

  it("boş turda 0 verir", () => {
    expect(totalScore([])).toBe(0);
  });

  it("tam sayıya yuvarlar", () => {
    expect(totalScore([100, 100, 99])).toBe(100);
  });
});

describe("isScoped — kapsam bildirimi", () => {
  /**
   * Maç, gol ve kulüp sayısı yalnızca §1.3'teki yirmi iki ligi kapsar; millî maç,
   * boy ve kilo oyuncunun kendi kaydından gelir ve kapsamdan bağımsızdır.
   */
  it("kulüp kaynaklı istatistikleri işaretler", () => {
    expect(isScoped("appearances")).toBe(true);
    expect(isScoped("goals")).toBe(true);
    expect(isScoped("clubs")).toBe(true);
  });

  it("oyuncu kaynaklı istatistikleri işaretlemez", () => {
    expect(isScoped("nationalCaps")).toBe(false);
    expect(isScoped("heightCm")).toBe(false);
    expect(isScoped("weightKg")).toBe(false);
  });
});

describe("isPlayerAlreadyUsed — BR-17", () => {
  const used = new Map<StatKey, string>([
    ["appearances", "p1"],
    ["goals", "p2"],
  ]);

  it("başka istatistikte kullanılmış oyuncuyu yakalar", () => {
    expect(isPlayerAlreadyUsed(used, "p1", "clubs")).toBe(true);
  });

  /** Hedef istatistiğin KENDİ cevabı "kullanılmış" sayılmaz. */
  it("hedefin kendi cevabını saymaz", () => {
    expect(isPlayerAlreadyUsed(used, "p1", "appearances")).toBe(false);
  });

  it("hiç kullanılmamış oyuncu serbesttir", () => {
    expect(isPlayerAlreadyUsed(used, "p9", "clubs")).toBe(false);
  });
});

describe("isRoundComplete", () => {
  it("altı cevaptan sonra biter", () => {
    expect(isRoundComplete(STAT_KEYS.length)).toBe(true);
    expect(isRoundComplete(STAT_KEYS.length - 1)).toBe(false);
  });
});
