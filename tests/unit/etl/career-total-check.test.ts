import { describe, expect, it } from "vitest";
import { checkCareerTotals } from "../../../scripts/etl/pipeline/career-total-check";
import type { NormalizedSpell } from "../../../scripts/etl/pipeline/normalize";

/**
 * §9.2 — kariyer toplamının kendi lig sayımızla çapraz denetimi.
 *
 * NEDEN VAR: ayrıştırıcı üç turluk sıkılaştırmadan sonra bile okuduklarının
 * %3,5'ini yanlış okuyor ve o kusur ayrıştırıcının İÇİNDEN çözülemez —
 * `career-total.ts` saftır, bizim lig sayımızı bilmez (§8.1). İlk iki test
 * ölçülen gerçek vakalardır.
 */

function spell(over: Partial<NormalizedSpell> = {}): NormalizedSpell {
  return {
    wikidataStatementId: "Q1-aaa",
    playerWikidataId: "Q1",
    clubWikidataId: "Q-club",
    startYear: 2010,
    endYear: 2015,
    isCurrent: false,
    isLoan: false,
    isYouth: false,
    appearances: 100,
    goals: 20,
    ...over,
  };
}

describe("checkCareerTotals — bütün, parçasından küçük olamaz", () => {
  it("POPESCU VAKASI: kariyer golü lig golümüzden AZSA düşer", () => {
    // Ölçüldü: Vikipedi 642 maç / 77 gol diyor, bizim yalnız LİG sayımız
    // 623/87. "Bütün kulvarların toplamı" lig golünden az olamaz.
    const result = checkCareerTotals({
      careerTotals: new Map([["Q1", { appearances: 642, goals: 77 }]]),
      spells: [spell({ appearances: 623, goals: 87 })],
    });

    expect(result.accepted.size).toBe(0);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.reason).toBe("goals");
    expect(result.conflicts[0]?.leagueGoals).toBe(87);
  });

  it("BEYE VAKASI: kariyer maçı lig maçımızdan AZSA düşer", () => {
    // Ölçüldü: 262/5 ↔ 359/15. Maç sayısı ilk elenen ölçüttür.
    const result = checkCareerTotals({
      careerTotals: new Map([["Q1", { appearances: 262, goals: 5 }]]),
      spells: [spell({ appearances: 359, goals: 15 })],
    });

    expect(result.conflicts[0]?.reason).toBe("appearances");
  });

  it("tutarlı kayıt geçer", () => {
    // Ronaldo: kariyer 1.099/830, bizim lig sayımız 758/600.
    const result = checkCareerTotals({
      careerTotals: new Map([["Q1", { appearances: 1099, goals: 830 }]]),
      spells: [spell({ appearances: 758, goals: 600 })],
    });

    expect(result.conflicts).toEqual([]);
    expect(result.accepted.get("Q1")).toEqual({
      appearances: 1099,
      goals: 830,
    });
  });

  it("EŞİTLİK geçer — lig dışı hiç maçı olmayan oyuncu meşrudur", () => {
    const result = checkCareerTotals({
      careerTotals: new Map([["Q1", { appearances: 100, goals: 20 }]]),
      spells: [spell({ appearances: 100, goals: 20 })],
    });

    expect(result.accepted.size).toBe(1);
  });

  it("birden çok dönem TOPLANIR", () => {
    const result = checkCareerTotals({
      careerTotals: new Map([["Q1", { appearances: 250, goals: 30 }]]),
      spells: [
        spell({ appearances: 150, goals: 20 }),
        spell({ wikidataStatementId: "Q1-bbb", appearances: 130, goals: 15 }),
      ],
    });

    // Lig toplamı 280/35 > 250/30 → düşer.
    expect(result.conflicts[0]?.leagueAppearances).toBe(280);
    expect(result.accepted.size).toBe(0);
  });

  /**
   * BR-16'nın aynısı: tek bir dönemde bile eksik değer varsa toplam
   * yanıltıcıdır. Yanıltıcı bir sayıyla denetim yapmak, denetimin kendisini
   * yanıltıcı yapar — o oyuncuda kıyas ölçüsü YOK sayılır.
   */
  it("lig sayımız EKSİKSE kıyas yapılmaz, kayıt geçer", () => {
    const result = checkCareerTotals({
      careerTotals: new Map([["Q1", { appearances: 10, goals: 1 }]]),
      spells: [
        spell({ appearances: 150, goals: 20 }),
        spell({ wikidataStatementId: "Q1-bbb", appearances: null, goals: 5 }),
      ],
    });

    expect(result.accepted.size).toBe(1);
    expect(result.conflicts).toEqual([]);
  });

  it("hiç dönemi olmayan oyuncuda kıyas yapılmaz", () => {
    const result = checkCareerTotals({
      careerTotals: new Map([["Q1", { appearances: 10, goals: 1 }]]),
      spells: [],
    });

    expect(result.accepted.size).toBe(1);
  });

  it("ALTYAPI dönemleri lig sayımıza girmez", () => {
    // BR-2: altyapı kaydı kariyer sayılmaz; kıyasa katmak kapıyı yanlış
    // yerde sıkılaştırırdı.
    const result = checkCareerTotals({
      careerTotals: new Map([["Q1", { appearances: 120, goals: 20 }]]),
      spells: [
        spell({ appearances: 100, goals: 20 }),
        spell({
          wikidataStatementId: "Q1-genc",
          isYouth: true,
          appearances: 80,
          goals: 40,
        }),
      ],
    });

    expect(result.accepted.size).toBe(1);
  });

  /**
   * KİRALIK DÖNEMLER İÇERİDE — `cross-check.ts`'ten kasıtlı ayrım. Orada soru
   * "oyuncu bu kulüpte miydi" idi; burada bir TOPLAM'ın büyüklüğü ve kiralıkta
   * oynanan maç da kariyerin parçasıdır.
   */
  it("KİRALIK dönemler lig sayımıza DÂHİLDİR", () => {
    const result = checkCareerTotals({
      careerTotals: new Map([["Q1", { appearances: 120, goals: 20 }]]),
      spells: [
        spell({ appearances: 100, goals: 15 }),
        spell({
          wikidataStatementId: "Q1-kira",
          isLoan: true,
          appearances: 50,
          goals: 10,
        }),
      ],
    });

    // 150/25 > 120/20 → düşer. Kiralık dışarıda bırakılsaydı geçerdi.
    expect(result.accepted.size).toBe(0);
    expect(result.conflicts[0]?.leagueAppearances).toBe(150);
  });

  it("başka oyuncunun dönemi bu oyuncuyu düşüremez", () => {
    const result = checkCareerTotals({
      careerTotals: new Map([["Q1", { appearances: 120, goals: 20 }]]),
      spells: [spell({ playerWikidataId: "Q2", appearances: 900, goals: 700 })],
    });

    expect(result.accepted.size).toBe(1);
  });

  it("çelişki kaydı, incelenebilmesi için iki tarafı da taşır", () => {
    const result = checkCareerTotals({
      careerTotals: new Map([["Q9", { appearances: 262, goals: 5 }]]),
      spells: [spell({ playerWikidataId: "Q9", appearances: 359, goals: 15 })],
    });

    expect(result.conflicts[0]).toEqual({
      playerWikidataId: "Q9",
      parsed: { appearances: 262, goals: 5 },
      leagueAppearances: 359,
      leagueGoals: 15,
      reason: "appearances",
    });
  });

  it("boş girdi boş sonuç verir", () => {
    const result = checkCareerTotals({ careerTotals: new Map(), spells: [] });

    expect(result.accepted.size).toBe(0);
    expect(result.conflicts).toEqual([]);
  });
});
