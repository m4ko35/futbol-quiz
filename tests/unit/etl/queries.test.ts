import { describe, expect, it } from "vitest";

import {
  clubDuplicates,
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

describe("clubDuplicates — §5.3 ikiz ayrımı", () => {
  const sparql = clubDuplicates(["Q641373", "Q20473364"]);

  /**
   * ÖNCEKİ KURAL "iki taraf da Q476028 ise ele" diyordu ve ÖLÇÜLEREK yanlış
   * bulundu: Wikidata çok şubeli kulüpleri İKİ sınıfla birden etiketliyor
   * (IFK Norrköping ve Örgryte IS = Q847017 + Q476028). Şube de doğal olarak
   * Q476028 taşıdığı için koşul GERÇEK ikizlerde de sağlanıyor, kural onları
   * kendi elinde tuttuğu hâlde eliyordu.
   *
   * Bu test o kuralın geri gelmesini engelliyor: sorgu ikizi Q476028
   * simetrisiyle DEĞİL, şemsiye sınıfı asimetrisiyle ayırmalı.
   */
  it("ayrımı Q476028 simetrisine dayandırmaz", () => {
    expect(sparql).not.toMatch(/wd:Q476028/u);
  });

  it("ebeveynde ŞEMSİYE sınıfı arar", () => {
    expect(sparql).toMatch(/\?parent wdt:P31 \?parentClass/u);
    expect(sparql).toMatch(/VALUES \?parentClass \{[^}]*wd:Q847017[^}]*\}/u);
    expect(sparql).toMatch(/VALUES \?parentClass \{[^}]*wd:Q13580678[^}]*\}/u);
  });

  /**
   * ASİMETRİ ŞART. Yalnızca "ebeveyn şemsiye" arasaydı, iki şemsiye kulübün
   * birbirine bağlandığı hâller de ikiz sayılırdı; kuralın söylediği şey
   * "biri şemsiye, öteki DEĞİL".
   */
  it("kulübün şemsiye OLMADIĞINI da denetler", () => {
    expect(sparql).toMatch(
      /FILTER NOT EXISTS \{[\s\S]*\?club wdt:P31 \?clubClass/u,
    );
  });

  it("iki bağı da okur (P361 ve P831) ve kendine bağlıyı eler", () => {
    expect(sparql).toMatch(/wdt:P361\|wdt:P831/u);
    expect(sparql).toMatch(/FILTER\(\?club != \?parent\)/u);
  });

  it("QID biçimini doğrular (enjeksiyon koruması)", () => {
    expect(() => clubDuplicates(["Q1; DROP"])).toThrow(/Geçersiz/u);
  });
});
