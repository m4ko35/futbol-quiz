import { describe, expect, it } from "vitest";
import {
  findContradictions,
  MIN_CONTRADICTION_APPEARANCES,
} from "../../../scripts/etl/pipeline/cross-check";
import type { WikipediaSpell } from "../../../scripts/etl/pipeline/merge-wikipedia";
import type { NormalizedSpell } from "../../../scripts/etl/pipeline/normalize";
import type { UnresolvedClubRow } from "../../../scripts/etl/pipeline/wikipedia-pass";

/**
 * §4.3, §8.2 — çapraz kaynak denetimi (BR-42).
 *
 * BURADAKİ TESTLERİN ÖLÇÜTÜ: gerçek olay. 11 Ağustos 2026'da Rafael Leão'nun
 * Wikidata kaydında Milan → Real Madrid değişikliği yapıldı ve ETL onu aldı.
 * İlk test o vakanın birebir şeklidir; kalanlar kuralın nerede SUSMASI
 * gerektiğini tutuyor — bir kapı, yanlış yere kapandığında kapatılır.
 */

function wd(over: Partial<NormalizedSpell> = {}): NormalizedSpell {
  return {
    wikidataStatementId: "Q1-aaa",
    playerWikidataId: "Q1",
    clubWikidataId: "Q-real",
    startYear: 2019,
    endYear: null,
    isCurrent: true,
    isLoan: false,
    isYouth: false,
    appearances: 227,
    goals: 64,
    ...over,
  };
}

function wp(over: Partial<WikipediaSpell> = {}): WikipediaSpell {
  return {
    playerWikidataId: "Q1",
    clubWikidataId: "Q-milan",
    startYear: 2019,
    endYear: null,
    appearances: 218,
    goals: 64,
    isLoan: false,
    sites: ["en"],
    ...over,
  };
}

/** Evrendeki bir kulübe bağlanamamış bilgi kutusu satırı. */
function ur(over: Partial<UnresolvedClubRow> = {}): UnresolvedClubRow {
  return {
    playerWikidataId: "Q1",
    clubTitle: "AEK Athens F.C.",
    site: "en",
    startYear: 2019,
    endYear: null,
    isLoan: false,
    ...over,
  };
}

/** Çağrıların çoğu yalnızca çelişki listesine bakıyor. */
function celiskiler(
  input: Parameters<typeof findContradictions>[0],
): ReturnType<typeof findContradictions>["contradictions"] {
  return findContradictions(input).contradictions;
}

describe("BR-42 — Vikipedi'nin çürüttüğü Wikidata dönemi", () => {
  it("LEÃO VAKASI: aynı yılları başka kulüple dolduran bilgi kutusu çelişki sayılır", () => {
    // Wikidata: Real Madrid 2019–…, 227 maç. Vikipedi: Milan 2019–…, 218 maç.
    // İkisi de AÇIK UÇLU; eski örtüşme uyarısı tam da bu yüzden susuyordu.
    const found = celiskiler({ spells: [wd()], wikipedia: [wp()] });

    expect(found).toHaveLength(1);
    expect(found[0]?.clubWikidataId).toBe("Q-real");
    expect(found[0]?.wikipediaClubs).toEqual(["Q-milan"]);
    // İfade kimliği taşınıyor: insan tek tek inceleyebilmeli.
    expect(found[0]?.spellId).toBe("Q1-aaa");
  });

  it("kulüp bilgi kutusunda GEÇİYORSA çelişki yoktur", () => {
    const found = celiskiler({
      spells: [wd({ clubWikidataId: "Q-milan" })],
      wikipedia: [wp()],
    });

    expect(found).toEqual([]);
  });

  it("oyuncunun Vikipedi kaydı YOKSA sessiz kalır", () => {
    // İkinci kaynağın sessizliği kanıt değildir (§2.7). Bilgi kutusu kapsamı
    // %100 değil; olmayan kaynağa dayanarak iddia üretmek kapıyı gürültüye
    // boğar ve gürültülü kapı kapatılır.
    const found = celiskiler({ spells: [wd()], wikipedia: [] });

    expect(found).toEqual([]);
  });

  it("bilgi kutusu o YILLARI hiç kapsamıyorsa sessiz kalır", () => {
    // Kulüp eksik ama yıllar da boş: bu "eksik bilgi kutusu"dur, çelişki değil.
    const found = celiskiler({
      spells: [wd({ startYear: 2019, endYear: 2021 })],
      wikipedia: [wp({ startYear: 2012, endYear: 2015 })],
    });

    expect(found).toEqual([]);
  });

  it("SINIRA DEĞMEK örtüşme değildir", () => {
    // 2016–2019 ile 2019–2022 aynı sezonu paylaşmaz; transfer yılı ortaktır.
    // Bunu örtüşme saymak her normal transferi çelişki yapardı.
    const found = celiskiler({
      spells: [wd({ startYear: 2016, endYear: 2019 })],
      wikipedia: [wp({ startYear: 2019, endYear: 2022 })],
    });

    expect(found).toEqual([]);
  });

  it("KİRALIK dönemler iki tarafta da dışarıda", () => {
    // Kiralık, oyuncunun aynı anda iki kulüple ilişkili göründüğü MEŞRU
    // durumdur — denetimin varsayımını kıracak tek şey odur.
    expect(
      celiskiler({ spells: [wd({ isLoan: true })], wikipedia: [wp()] }),
    ).toEqual([]);

    expect(
      celiskiler({ spells: [wd()], wikipedia: [wp({ isLoan: true })] }),
    ).toEqual([]);
  });

  it("ALTYAPI dönemleri dışarıda", () => {
    const found = celiskiler({
      spells: [wd({ isYouth: true })],
      wikipedia: [wp()],
    });

    expect(found).toEqual([]);
  });

  it("maç sayısı eşiğin ALTINDAysa çelişki iddia edilmez", () => {
    // Bilgi kutuları kısa ve maçsız dönemleri sık atlar; o eksiklikleri
    // çelişki saymak kapıyı kullanılamaz hâle getirir.
    const az = celiskiler({
      spells: [wd({ appearances: MIN_CONTRADICTION_APPEARANCES - 1 })],
      wikipedia: [wp()],
    });
    expect(az).toEqual([]);

    const tam = celiskiler({
      spells: [wd({ appearances: MIN_CONTRADICTION_APPEARANCES })],
      wikipedia: [wp()],
    });
    expect(tam).toHaveLength(1);
  });

  it("maç sayısı BİLİNMİYORSA çelişki iddia edilmez", () => {
    // `null` sıfır değildir (§2.7) ama kanıt da değildir: kanıtsız bir kayda
    // dayanarak ikinci kaynağı yanlış ilan edemeyiz.
    const found = celiskiler({
      spells: [wd({ appearances: null })],
      wikipedia: [wp()],
    });

    expect(found).toEqual([]);
  });

  it("başlangıç yılı olmayan dönem karşılaştırılamaz", () => {
    const found = celiskiler({
      spells: [wd({ startYear: null })],
      wikipedia: [wp()],
    });

    expect(found).toEqual([]);
  });

  it("birden çok rakip kulüp TEKİLLEŞTİRİLİR", () => {
    const found = celiskiler({
      spells: [wd({ startYear: 2019, endYear: 2023 })],
      wikipedia: [
        wp({ clubWikidataId: "Q-milan", startYear: 2019, endYear: 2021 }),
        wp({ clubWikidataId: "Q-milan", startYear: 2021, endYear: 2022 }),
        wp({ clubWikidataId: "Q-lille", startYear: 2020, endYear: 2022 }),
      ],
    });

    expect(found).toHaveLength(1);
    expect([...(found[0]?.wikipediaClubs ?? [])].sort()).toEqual([
      "Q-lille",
      "Q-milan",
    ]);
  });

  it("başka oyuncunun bilgi kutusu bu oyuncuyu çürütemez", () => {
    const found = celiskiler({
      spells: [wd({ playerWikidataId: "Q1" })],
      wikipedia: [wp({ playerWikidataId: "Q2" })],
    });

    expect(found).toEqual([]);
  });
});

/**
 * 4. koruma — kapı kör olduğu yerde hüküm vermez (§8.2, 21 Ağustos 2026).
 *
 * ÖLÇÜTÜ YİNE GERÇEK VAKA: Orbelín Pineda'nın Wikidata'daki AEK Atina kaydı
 * (2023–2026, 94 maç) DOĞRUYDU ama çelişki ilan edilmişti. Sebep, bilgi
 * kutusundaki AEK bağlantısının evren indeksinde bulunamayıp ATILMASI —
 * yani "kulüp bilgi kutusunda hiç geçmiyor" koşulu, Vikipedi öyle demediği
 * için değil biz okuyamadığımız için doğru çıkmıştı.
 */
describe("BR-42 — okunamayan bağlantı varsa karar verilmez", () => {
  it("PINEDA VAKASI: aynı yıllara denk gelen okunamamış satır çelişkiyi düşürür", () => {
    const sonuc = findContradictions({
      spells: [wd()],
      wikipedia: [wp()],
      unresolved: [ur()],
    });

    expect(sonuc.contradictions).toEqual([]);
    expect(sonuc.undecided).toHaveLength(1);
    expect(sonuc.undecided[0]?.spellId).toBe("Q1-aaa");
    // Kararı neyin engellediği yazılıyor: indekse eklenecek ad bu.
    expect(sonuc.undecided[0]?.unreadTitles).toEqual(["AEK Athens F.C."]);
    // Rakip kulüp de taşınıyor — inceleyen ikisini birden görmeli.
    expect(sonuc.undecided[0]?.wikipediaClubs).toEqual(["Q-milan"]);
  });

  it("okunamamış satır BAŞKA yıllardaysa çelişki durur", () => {
    // Kapı gevşemiyor: körlük, örtüştüğü yerde engel olur. Kariyerin başka bir
    // ucundaki okunamamış alt lig satırı bütün denetimi susturamaz.
    const sonuc = findContradictions({
      spells: [wd({ startYear: 2019, endYear: 2023 })],
      wikipedia: [wp({ startYear: 2019, endYear: 2023 })],
      unresolved: [ur({ startYear: 2005, endYear: 2008 })],
    });

    expect(sonuc.contradictions).toHaveLength(1);
    expect(sonuc.undecided).toEqual([]);
  });

  it("YILI OKUNAMAMIŞ satır da karar verdirmez", () => {
    // Aralığı bilinmeyen satırın tartışmalı yıllara denk gelip gelmediği
    // bilinemez; "denk gelmiyor" saymak kapatılan açığın ta kendisi olurdu.
    const sonuc = findContradictions({
      spells: [wd()],
      wikipedia: [wp()],
      unresolved: [ur({ startYear: null, endYear: null })],
    });

    expect(sonuc.contradictions).toEqual([]);
    expect(sonuc.undecided).toHaveLength(1);
  });

  it("KİRALIK okunamamış satır engellemez", () => {
    // Kiralık satırlar denetimin her iki tarafında da kapsam dışı; okunamamış
    // olanı ayrı davranmak asimetri yaratırdı.
    const sonuc = findContradictions({
      spells: [wd()],
      wikipedia: [wp()],
      unresolved: [ur({ isLoan: true })],
    });

    expect(sonuc.contradictions).toHaveLength(1);
    expect(sonuc.undecided).toEqual([]);
  });

  it("BAŞKA oyuncunun okunamamış satırı bu oyuncuyu koruyamaz", () => {
    const sonuc = findContradictions({
      spells: [wd({ playerWikidataId: "Q1" })],
      wikipedia: [wp({ playerWikidataId: "Q1" })],
      unresolved: [ur({ playerWikidataId: "Q2" })],
    });

    expect(sonuc.contradictions).toHaveLength(1);
    expect(sonuc.undecided).toEqual([]);
  });

  it("`undecided`, yalnızca ESKİ KURALIN çelişki sayacağı kayıtları içerir", () => {
    // Sıra kasıtlı: 4. koşul en sonda. Diğer koşullardan biri düşen bir kayıt
    // ne çelişki ne de "karar verilemedi" olur — yoksa iki sayı toplandığında
    // eski sayıyı vermez ve körlüğün büyüklüğü ölçülemezdi.
    const sonuc = findContradictions({
      spells: [wd({ appearances: 3 })], // eşiğin altında
      wikipedia: [wp()],
      unresolved: [ur()],
    });

    expect(sonuc.contradictions).toEqual([]);
    expect(sonuc.undecided).toEqual([]);
  });

  it("`unresolved` verilmezse kapı eskisi gibi davranır", () => {
    const sonuc = findContradictions({ spells: [wd()], wikipedia: [wp()] });

    expect(sonuc.contradictions).toHaveLength(1);
    expect(sonuc.undecided).toEqual([]);
  });
});
