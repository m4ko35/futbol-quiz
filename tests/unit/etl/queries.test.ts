import { describe, expect, it } from "vitest";

import {
  clubsByLeagueLink,
  clubsFromSeasonParents,
  clubsFromSeasons,
} from "../../../scripts/etl/sources/wikidata/queries";

/**
 * SPARQL kurucuları — PROJECT.md §5.3.
 *
 * ÜRETİLEN METNİ TEST ETMEK normalde kırılgandır; burada gerekçesi var.
 * Kulüp evreninden bir kulübün düşmesi HATA VERMEZ — veri kümesi sessizce
 * küçülür ve bunu ancak birinin oyunda o kulübü araması ortaya çıkarır
 * (Adana Demirspor tam olarak böyle bulundu). Bu testler, ölçülerek
 * düzeltilmiş iki kararın kazara geri alınmasını engelliyor.
 */

const SUPER_LIG = "Q485568";

describe("clubsByLeagueLink", () => {
  const sparql = clubsByLeagueLink(SUPER_LIG);

  /**
   * `wdt:` KESTİRMESİ KÜME DÜŞEN KULÜBÜ KAYBETTİRİR. Kestirme yalnızca
   * tercih edilen rütbedeki değeri döner; küme düşünce eski lig ifadesi
   * normal rütbeye iniyor ve kulüp evrenden çıkıyor. Adana Demirspor'un 262
   * dönemi bu yüzden hiç görünmüyordu.
   */
  it("tüm P118 ifadelerini okur, yalnızca kestirmeyi değil", () => {
    expect(sparql).toContain("p:P118");
    expect(sparql).toContain("ps:P118");
    expect(sparql).not.toContain("wdt:P118");
  });

  /** `deprecated` = "yanlış olduğu bilinen"; okumak bilerek hata almaktır. */
  it("deprecated rütbeli ifadeleri dışarıda bırakır", () => {
    expect(sparql).toContain("wikibase:DeprecatedRank");
    expect(sparql).toMatch(/FILTER\(\?rank\s*!=\s*wikibase:DeprecatedRank\)/u);
  });

  /**
   * Tür kısıtı üç sorguda da zorunlu: kısıtsız sorgu oyuncuları da döndürüyor
   * (`P118` insanlarda da kullanılıyor — 9091 sonucun 6066'sı insandı).
   */
  it("kulüp sınıfı kısıtını taşır", () => {
    expect(sparql).toContain("wdt:P31/wdt:P279*");
    expect(sparql).toContain("Q476028");
  });
});

describe("QID enjeksiyon koruması", () => {
  /**
   * Lig kimliği sorgu METNİNE gömülüyor. Biçim doğrulanmazsa `leagues.ts`
   * içindeki bir yazım hatası sessiz bir sorguya değil, bozuk SPARQL'e
   * dönüşür — ya da daha kötüsü, çalışan ama yanlış bir sorguya.
   */
  it.each([
    ["Q1 } UNION { ?club ?p ?o", "enjeksiyon denemesi"],
    ["Q", "rakamsız"],
    ["485568", "Q öneki yok"],
    ["", "boş"],
  ])("%s reddedilir (%s)", (bad) => {
    for (const build of [
      clubsByLeagueLink,
      clubsFromSeasons,
      clubsFromSeasonParents,
    ]) {
      expect(() => build(bad)).toThrow(/Geçersiz Wikidata QID/u);
    }
  });

  it("geçerli QID kabul edilir", () => {
    expect(() => clubsByLeagueLink(SUPER_LIG)).not.toThrow();
  });
});
