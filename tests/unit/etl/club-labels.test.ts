import { describe, expect, it } from "vitest";

import { disambiguateShortNames } from "../../../scripts/etl/pipeline/club-labels";
import type { NormalizedClub } from "../../../scripts/etl/pipeline/normalize";

/**
 * Seçicide ayırt edilebilir kısa ad — PROJECT.md §5.3.
 *
 * Bu geçişin sınavı iki yönlü: çakışanı AÇMALI, çakışmayana DOKUNMAMALI.
 * İkincisi daha kolay bozulur — 383 kulübün 380'i kısa adını korumalı, yoksa
 * seçici birdenbire "Galatasaray Spor Kulübü" basmaya başlar.
 */

function club(
  over: Partial<NormalizedClub> & { wikidataId: string },
): NormalizedClub {
  return {
    name: "Kulüp",
    shortName: "Kulüp",
    searchKey: "kulup",
    country: "FR",
    foundedYear: null,
    crestUrl: null,
    leagueWikidataId: null,
    ...over,
  };
}

/** Ölçülen üç kümeden ikisi bu şekilde: kısa ad aynı, tam ad farklı. */
const TROYES = [
  club({
    wikidataId: "Q501693",
    name: "Troyes AC",
    shortName: "Troyes",
    foundedYear: 1986,
  }),
  club({
    wikidataId: "Q2868069",
    name: "AS Troyes",
    shortName: "Troyes",
    foundedYear: 1900,
  }),
];

/** Üçüncü küme: tam ad da aynı, yalnızca kuruluş yılı ayırıyor. */
const TOULOUSE = [
  club({
    wikidataId: "Q2422417",
    name: "Toulouse FC",
    shortName: "Toulouse",
    foundedYear: 1937,
  }),
  club({
    wikidataId: "Q19518",
    name: "Toulouse FC",
    shortName: "Toulouse",
    foundedYear: 1970,
  }),
];

function shortNames(clubs: readonly NormalizedClub[]): Record<string, string> {
  return Object.fromEntries(clubs.map((c) => [c.wikidataId, c.shortName]));
}

describe("disambiguateShortNames", () => {
  it("çakışma yoksa girdiyi olduğu gibi döner", () => {
    const input = [
      club({
        wikidataId: "Q495299",
        name: "Galatasaray SK",
        shortName: "Galatasaray",
      }),
      club({
        wikidataId: "Q19648",
        name: "Fenerbahçe SK",
        shortName: "Fenerbahçe",
      }),
    ];
    const result = disambiguateShortNames(input);

    expect(result.clubs).toEqual(input);
    expect(result.stats).toEqual({
      collidingGroups: 0,
      renamed: 0,
      unresolved: [],
    });
  });

  it("kademe 1: tam ad ayırıyorsa tam ada geçer", () => {
    const result = disambiguateShortNames(TROYES);

    expect(shortNames(result.clubs)).toEqual({
      Q501693: "Troyes AC",
      Q2868069: "AS Troyes",
    });
    expect(result.stats.collidingGroups).toBe(1);
    expect(result.stats.renamed).toBe(2);
    expect(result.stats.unresolved).toEqual([]);
  });

  /** ÖLÇÜLDÜ: kuruluş yılı, tam adın çözemediği tek kümeyi çözüyor. */
  it("kademe 2: tam ad da çakışıyorsa kuruluş yılını ekler", () => {
    const result = disambiguateShortNames(TOULOUSE);

    expect(shortNames(result.clubs)).toEqual({
      Q2422417: "Toulouse FC (1937)",
      Q19518: "Toulouse FC (1970)",
    });
    expect(result.stats.unresolved).toEqual([]);
  });

  it("yalnızca çakışan kümeye dokunur", () => {
    const digerleri = [
      club({
        wikidataId: "Q495299",
        name: "Galatasaray SK",
        shortName: "Galatasaray",
      }),
      club({
        wikidataId: "Q9616",
        name: "Paris Saint-Germain FC",
        shortName: "Paris Saint-Germain",
      }),
    ];
    const result = disambiguateShortNames([...digerleri, ...TOULOUSE]);

    expect(result.clubs.slice(0, 2)).toEqual(digerleri);
    expect(result.stats.renamed).toBe(2);
  });

  /** Seçici ülkeyi de basıyor; farklı ülke zaten ayırt edilebilir. */
  it("ülkeler farklıysa çakışma saymaz", () => {
    const result = disambiguateShortNames([
      club({
        wikidataId: "Q1",
        name: "Valencia CF",
        shortName: "Valencia",
        country: "ES",
      }),
      club({
        wikidataId: "Q2",
        name: "Valencia FC",
        shortName: "Valencia",
        country: "VE",
      }),
    ]);

    expect(result.stats.collidingGroups).toBe(0);
    expect(result.stats.renamed).toBe(0);
  });

  /**
   * SORU "aynı anlama mı geliyor" DEĞİL, "kullanıcı ayırt edebiliyor mu".
   * Harfi farklı iki etiket ayırt edilebilir, dokunulmaz.
   *
   * Bu testin ilk hâli tersini bekliyordu ve gerçek bir kusur buldu:
   * karşılaştırma `toLocaleLowerCase("tr")` yapıyordu, Türkçede `I` → `ı`
   * olduğu için bu iki ad zaten eşleşmiyordu. Yerel ayara bağlı harf çevirimi
   * çok dilli veride sessizce yanlış cevap veriyor; karşılaştırma birebir oldu.
   */
  it("harf farkı olan etiketlere dokunmaz", () => {
    const input = [
      club({
        wikidataId: "Q1",
        name: "Real Madrid CF",
        shortName: "Real Madrid",
      }),
      club({
        wikidataId: "Q2",
        name: "Real Madrid Castilla",
        shortName: "REAL MADRID",
      }),
    ];
    const result = disambiguateShortNames(input);

    expect(result.clubs).toEqual(input);
    expect(result.stats.collidingGroups).toBe(0);
  });

  /**
   * KAYNAKTA BİRLEŞTİRİLMESİ GEREKEN İKİZ. Üç kademe de tükendiğinde ad
   * DEĞİŞTİRİLMEZ — uydurulmuş bir ayırt edici, gösterim sorununu veri
   * sorununun üstünü örterek kapatırdı.
   */
  it("kuruluş yılı yoksa adı değiştirmez ve çakışmayı bildirir", () => {
    const result = disambiguateShortNames([
      club({
        wikidataId: "Q641373",
        name: "Gençlerbirliği",
        shortName: "Gençlerbirliği",
        country: "TR",
      }),
      club({
        wikidataId: "Q20473364",
        name: "Gençlerbirliği",
        shortName: "Gençlerbirliği",
        country: "TR",
      }),
    ]);

    expect(result.stats.renamed).toBe(0);
    expect(result.stats.unresolved).toEqual(["Gençlerbirliği"]);
    expect(shortNames(result.clubs)).toEqual({
      Q641373: "Gençlerbirliği",
      Q20473364: "Gençlerbirliği",
    });
  });

  it("kuruluş yılı da aynıysa çakışmayı bildirir", () => {
    const result = disambiguateShortNames([
      club({
        wikidataId: "Q1",
        name: "FC Aynı",
        shortName: "Aynı",
        foundedYear: 1900,
      }),
      club({
        wikidataId: "Q2",
        name: "FC Aynı",
        shortName: "Aynı",
        foundedYear: 1900,
      }),
    ]);

    expect(result.stats.renamed).toBe(0);
    expect(result.stats.unresolved).toEqual(["Aynı"]);
  });

  it("bir tarafın yılı varken diğerininki yoksa yalnızca ayırt edilebileni açar", () => {
    const result = disambiguateShortNames([
      club({
        wikidataId: "Q1",
        name: "FC Aynı",
        shortName: "Aynı",
        foundedYear: 1900,
      }),
      club({
        wikidataId: "Q2",
        name: "FC Aynı",
        shortName: "Aynı",
        foundedYear: null,
      }),
    ]);

    expect(shortNames(result.clubs)).toEqual({
      Q1: "FC Aynı (1900)",
      Q2: "Aynı",
    });
    expect(result.stats.unresolved).toEqual([]);
  });

  /**
   * Kademe 1 tam adı kısa ada terfi ettiriyor; o adın evrende BAŞKA bir
   * kulübün kısa adı olması kuramsal olarak mümkün. Ölçümde yok, ama sessiz
   * kalmamalı — son denetim bu yüzden ayrı bir geçiş.
   */
  it("kademe 1'in ürettiği etiket başka bir kulüple çakışırsa bildirir", () => {
    const result = disambiguateShortNames([
      club({ wikidataId: "Q1", name: "Troyes AC", shortName: "Troyes" }),
      club({ wikidataId: "Q2", name: "AS Troyes", shortName: "Troyes" }),
      club({
        wikidataId: "Q3",
        name: "Troyes Athletic Club",
        shortName: "Troyes AC",
      }),
    ]);

    expect(result.stats.unresolved).toEqual(["Troyes AC"]);
  });

  it("aynı girdi aynı sonucu verir", () => {
    const build = () => disambiguateShortNames([...TROYES, ...TOULOUSE]);

    expect(build()).toEqual(build());
    expect(build().stats.collidingGroups).toBe(2);
    expect(build().stats.renamed).toBe(4);
  });
});
