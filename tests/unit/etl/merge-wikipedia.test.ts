import { describe, expect, it } from "vitest";

import {
  mergeWikipediaSpells,
  syntheticSpellId,
  type WikipediaSpell,
} from "../../../scripts/etl/pipeline/merge-wikipedia";
import type { NormalizedSpell } from "../../../scripts/etl/pipeline/normalize";

/**
 * Kaynak sözleşmesinin altı kuralı — PROJECT.md §4.3.
 *
 * Her kuralın kendi testi var çünkü kurallar birbirinin YERİNE geçebilir
 * görünüyor ama geçmiyor: "eksik dönem eklenir" ile "Vikipedi asla silmez"
 * aynı kaydı ters yönde etkiler ve birini gevşetmek diğerini bozar.
 */

const PLAYER = "Q1";
const GS = "Q495299";
const KONYA = "Q483740";
/** Kulüp evreninde OLMAYAN kulüp — alt lig. */
const OUTSIDE = "Q999999";

function spell(over: Partial<NormalizedSpell> = {}): NormalizedSpell {
  return {
    wikidataStatementId: "Q1-ABC",
    playerWikidataId: PLAYER,
    clubWikidataId: GS,
    startYear: 2015,
    endYear: 2018,
    isCurrent: false,
    isLoan: false,
    isYouth: false,
    appearances: 50,
    goals: 3,
    ...over,
  };
}

function fromWikipedia(over: Partial<WikipediaSpell> = {}): WikipediaSpell {
  return {
    playerWikidataId: PLAYER,
    clubWikidataId: GS,
    startYear: 2015,
    endYear: 2018,
    appearances: 50,
    goals: 3,
    isLoan: false,
    ...over,
  };
}

function merge(
  spells: NormalizedSpell[],
  wikipedia: WikipediaSpell[],
  clubIds: string[] = [GS, KONYA],
) {
  return mergeWikipediaSpells({
    spells,
    wikipedia,
    clubIds: new Set(clubIds),
    isYouthClub: () => false,
  });
}

describe("kural 1 — eksik dönem eklenir", () => {
  it("Wikidata'da olmayan kulüp dönemini ekler", () => {
    const result = merge(
      [spell()],
      [
        fromWikipedia({
          clubWikidataId: KONYA,
          startYear: 2011,
          endYear: 2014,
        }),
      ],
    );

    expect(result.stats.added).toBe(1);
    expect(result.spells).toHaveLength(2);
    expect(result.spells[1]).toMatchObject({
      clubWikidataId: KONYA,
      startYear: 2011,
      endYear: 2014,
    });
  });

  /**
   * Bardakçı'nın kaybolan Galatasaray dönemi tam olarak buydu: Wikidata'da
   * kulüpte hiç kaydı yoktu, bilgi kutusunda vardı.
   */
  it("oyuncunun hiç dönemi yoksa da ekler", () => {
    const result = merge([], [fromWikipedia()]);

    expect(result.stats.added).toBe(1);
    expect(result.spells[0]?.wikidataStatementId).toBe(
      "wikipedia-Q1-Q495299-2015",
    );
  });

  it("başlangıç yılı olmayan kaydı eklemez", () => {
    // Yıl olmadan kalıcı bir kimlik üretilemez; ikinci koşu satır çoğaltırdı.
    const result = merge([], [fromWikipedia({ startYear: null })]);

    expect(result.stats.added).toBe(0);
    expect(result.stats.skippedNoYear).toBe(1);
    expect(result.spells).toHaveLength(0);
  });
});

describe("kural 2 — var olan dönem zenginleşir", () => {
  it("boş maç ve gol alanlarını doldurur", () => {
    const result = merge(
      [spell({ appearances: null, goals: null })],
      [fromWikipedia({ appearances: 104, goals: 8 })],
    );

    expect(result.stats.enriched).toBe(1);
    expect(result.spells[0]).toMatchObject({ appearances: 104, goals: 8 });
  });

  it("boş bitiş yılını doldurur ve isCurrent'ı yeniden hesaplar", () => {
    const result = merge(
      [spell({ endYear: null, isCurrent: true })],
      [fromWikipedia({ endYear: 2018 })],
    );

    expect(result.spells[0]).toMatchObject({ endYear: 2018, isCurrent: false });
  });

  it("değişiklik yoksa kaydı olduğu gibi bırakır", () => {
    const original = spell();
    const result = merge([original], [fromWikipedia()]);

    expect(result.spells[0]).toBe(original);
    expect(result.stats).toMatchObject({ enriched: 0, overridden: 0 });
  });
});

describe("kural 3 — çelişkide Vikipedi kazanır", () => {
  it("farklı maç sayısında Vikipedi'ninkini yazar", () => {
    const result = merge(
      [spell({ appearances: 98 })],
      [fromWikipedia({ appearances: 104 })],
    );

    expect(result.stats.overridden).toBe(1);
    expect(result.spells[0]?.appearances).toBe(104);
  });

  it("kiralık bayrağını Vikipedi'ye göre düzeltir", () => {
    const result = merge(
      [spell({ isLoan: true })],
      [fromWikipedia({ isLoan: false })],
    );

    expect(result.spells[0]?.isLoan).toBe(false);
    expect(result.stats.overridden).toBe(1);
  });

  /**
   * BR-22 Vikipedi'ye de uygulanır: bilgi kutuları da yıl kılıklı maç sayısı
   * taşıyor ve 1987 "maç" bir maç sayısı değil, katılış yılıdır.
   */
  it("akla yatkın olmayan maç sayısını kabul etmez", () => {
    const result = merge(
      [spell({ appearances: 98 })],
      [fromWikipedia({ appearances: 1987 })],
    );

    expect(result.spells[0]?.appearances).toBe(98);
  });

  it("golün maçtan çok olduğu kaydı kabul etmez", () => {
    const result = merge(
      [spell({ appearances: 50, goals: 3 })],
      [fromWikipedia({ appearances: 60, goals: 90 })],
    );

    expect(result.spells[0]).toMatchObject({ appearances: 60, goals: 3 });
  });
});

describe("kural 4 — Vikipedi asla silmez", () => {
  /**
   * Ölçüldü: 400 oyunculuk örneklemde Wikidata'da olup bilgi kutusunda
   * OLMAYAN 320–346 kulüp var. Vikipedi bir üst küme değil.
   */
  it("bilgi kutusunda olmayan dönemi korur", () => {
    const result = merge([spell({ clubWikidataId: KONYA })], [fromWikipedia()]);

    expect(result.spells).toHaveLength(2);
    expect(result.spells[0]?.clubWikidataId).toBe(KONYA);
  });

  it("Vikipedi'nin boş değeri dolu değeri silmez", () => {
    const result = merge(
      [spell({ appearances: 50, endYear: 2018 })],
      [fromWikipedia({ appearances: null, endYear: null })],
    );

    expect(result.spells[0]).toMatchObject({ appearances: 50, endYear: 2018 });
  });
});

describe("kural 5 — kulüp evrenini Vikipedi belirlemez", () => {
  it("evren dışındaki kulübü atlar", () => {
    const result = merge([], [fromWikipedia({ clubWikidataId: OUTSIDE })]);

    expect(result.spells).toHaveLength(0);
    expect(result.stats.skippedOutOfUniverse).toBe(1);
  });
});

describe("eşleştirme — gidip dönen oyuncu", () => {
  /**
   * Bertrand @ Southampton: 2014 kiralık, 2015 kalıcı. Yıl eşleşmesi olmadan
   * ikisinden biri diğerinin üzerine yazılırdı.
   */
  it("başlangıç yılına göre doğru dönemi seçer", () => {
    const loan = spell({
      wikidataStatementId: "Q1-LOAN",
      startYear: 2014,
      endYear: 2014,
      appearances: null,
    });
    const permanent = spell({
      wikidataStatementId: "Q1-PERM",
      startYear: 2015,
      endYear: 2020,
      appearances: null,
    });

    const result = merge(
      [loan, permanent],
      [
        fromWikipedia({
          startYear: 2014,
          endYear: 2014,
          appearances: 22,
          isLoan: true,
        }),
        fromWikipedia({ startYear: 2015, endYear: 2020, appearances: 192 }),
      ],
    );

    const byId = new Map(result.spells.map((s) => [s.wikidataStatementId, s]));
    expect(byId.get("Q1-LOAN")?.appearances).toBe(22);
    expect(byId.get("Q1-PERM")?.appearances).toBe(192);
    expect(result.stats.added).toBe(0);
  });

  it("tek adayda bir yıllık kaymayı tolere eder", () => {
    // Ölçüldü: başlangıç yılları %96,2 birebir, ±1'de %2,8 daha. Hoşgörü
    // olmasa bu kayıtlar "yeni dönem" sayılıp kopya üretirdi.
    const result = merge(
      [spell({ startYear: 2015, appearances: null })],
      [fromWikipedia({ startYear: 2016, appearances: 77 })],
    );

    expect(result.stats.added).toBe(0);
    expect(result.spells).toHaveLength(1);
    expect(result.spells[0]?.appearances).toBe(77);
  });

  /**
   * Yıllar tutmuyor ama aralıklar ÖRTÜŞÜYOR: aynı dönemin iki kaynaktaki
   * farklı yazımı olabilir. İkinci bir kopya üretmek §8.2'nin "örtüşen kalıcı
   * dönem" uyarısını tetikler ve arayüzde kulüp iki kez görünürdü.
   */
  it("örtüşen belirsiz kaydı ne yazar ne ekler", () => {
    const result = merge(
      [spell({ startYear: 2010, endYear: 2020 })],
      [fromWikipedia({ startYear: 2015, endYear: 2018 })],
    );

    expect(result.spells).toHaveLength(1);
    expect(result.spells[0]?.startYear).toBe(2010);
    expect(result.stats).toMatchObject({ added: 0, skippedAmbiguous: 1 });
  });

  it("örtüşmeyen ikinci dönemi ekler", () => {
    // Aynı kulüpte 1998–2001 ve 2010–2012: aralıklar ayrık, belirsizlik yok.
    const result = merge(
      [spell({ startYear: 2010, endYear: 2012 })],
      [fromWikipedia({ startYear: 1998, endYear: 2001 })],
    );

    expect(result.spells).toHaveLength(2);
    expect(result.stats.added).toBe(1);
  });
});

describe("syntheticSpellId", () => {
  it("Wikidata ifade kimliğiyle çakışmaz", () => {
    const id = syntheticSpellId({
      playerWikidataId: PLAYER,
      clubWikidataId: GS,
      startYear: 2022,
    });

    expect(id).toBe("wikipedia-Q1-Q495299-2022");
    // Wikidata biçimi `Q161089-AD66DA21-…`; `wikipedia-` öneki onunla
    // karışamaz, yükleme bu yüzden idempotent kalır.
    expect(id.startsWith("wikipedia-")).toBe(true);
  });

  it("aynı girdide aynı kimliği üretir", () => {
    const twice = merge([], [fromWikipedia(), fromWikipedia()]);

    // İkinci kayıt ilkiyle örtüştüğü için eklenmez — kimlik çakışması da
    // böylece imkânsız olur.
    expect(twice.spells).toHaveLength(1);
  });
});
