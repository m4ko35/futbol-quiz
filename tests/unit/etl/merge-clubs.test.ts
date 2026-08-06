import { describe, expect, it } from "vitest";

import {
  mergeDuplicateClubs,
  type ClubLink,
} from "../../../scripts/etl/pipeline/merge-clubs";
import type {
  NormalizedClub,
  NormalizedSpell,
} from "../../../scripts/etl/pipeline/normalize";

/**
 * Kulüp ikizlerinin birleştirilmesi — PROJECT.md §5.3.
 *
 * BU MODÜL VERİ SİLEBİLİR ve testlerin ağırlığı oradan geliyor: yanlış bir
 * birleştirme iki gerçek kulübün geçmişini karıştırır ve geri alması zordur.
 * Hangi çiftlerin birleşeceğine SORGU karar veriyor (sınıf kısıtıyla); bu
 * modül yalnızca kendisine verilen bağı uygular — ama uygularken dönem
 * kaybettirmemesi gerekiyor.
 */

const FB = "Q6601875";
const FB_SK = "Q19648";
const GS = "Q495299";

function club(wikidataId: string, name = "Kulüp"): NormalizedClub {
  return {
    wikidataId,
    name,
    shortName: name,
    searchKey: name.toLowerCase(),
    country: "TR",
    foundedYear: null,
    crestUrl: null,
    leagueWikidataId: null,
  };
}

let sayac = 0;
function spell(over: Partial<NormalizedSpell> = {}): NormalizedSpell {
  sayac++;
  return {
    wikidataStatementId: `stmt-${sayac}`,
    playerWikidataId: "Q1",
    clubWikidataId: FB,
    startYear: 2010,
    endYear: 2012,
    isCurrent: false,
    isLoan: false,
    isYouth: false,
    appearances: 50,
    goals: 3,
    ...over,
  };
}

function merge(
  clubs: NormalizedClub[],
  spells: NormalizedSpell[],
  links: ClubLink[],
) {
  return mergeDuplicateClubs({ clubs, spells, links });
}

const LINK: ClubLink[] = [{ clubWikidataId: FB_SK, parentWikidataId: FB }];

describe("mergeDuplicateClubs", () => {
  it("gölge kulübü listeden çıkarır", () => {
    const result = merge(
      [club(FB, "Fenerbahçe"), club(FB_SK, "Fenerbahçe SK")],
      [spell({ clubWikidataId: FB }), spell({ clubWikidataId: FB })],
      LINK,
    );

    expect(result.clubs.map((c) => c.wikidataId)).toEqual([FB]);
    expect(result.stats.mergedClubs).toBe(1);
  });

  /**
   * YÖN TAHMİN EDİLMEZ, ÖLÇÜLÜR. `P831`/`P361` yönü Wikidata'da tutarsız;
   * karar mercii bu projede zaten dönem sayısıdır (§5.3).
   */
  it("çok dönemli tarafı asıl kabul eder, bağın yönüne bakmaz", () => {
    // Bağ FB → FB_SK yönünde, ama dönem FB_SK'da daha çok.
    const result = merge(
      [club(FB), club(FB_SK)],
      [
        spell({ clubWikidataId: FB_SK, playerWikidataId: "Q1" }),
        spell({ clubWikidataId: FB_SK, playerWikidataId: "Q2" }),
        spell({ clubWikidataId: FB, playerWikidataId: "Q3" }),
      ],
      [{ clubWikidataId: FB, parentWikidataId: FB_SK }],
    );

    expect(result.clubs.map((c) => c.wikidataId)).toEqual([FB_SK]);
    expect(result.spells.every((s) => s.clubWikidataId === FB_SK)).toBe(true);
  });

  it("ayrık dönemi asıl kulübe taşır", () => {
    const result = merge(
      [club(FB), club(FB_SK)],
      [
        spell({ clubWikidataId: FB, startYear: 2010, endYear: 2012 }),
        spell({ clubWikidataId: FB, startYear: 2014, endYear: 2015 }),
        spell({ clubWikidataId: FB_SK, startYear: 2018, endYear: 2020 }),
      ],
      LINK,
    );

    expect(result.stats.movedSpells).toBe(1);
    expect(result.spells).toHaveLength(3);
    expect(result.spells.every((s) => s.clubWikidataId === FB)).toBe(true);
  });

  it("birebir aynı dönemi ikinci kez eklemez", () => {
    const result = merge(
      [club(FB), club(FB_SK)],
      [
        spell({ clubWikidataId: FB, startYear: 2010, endYear: 2012 }),
        spell({ clubWikidataId: FB_SK, startYear: 2010, endYear: 2012 }),
      ],
      LINK,
    );

    expect(result.spells).toHaveLength(1);
    expect(result.stats.droppedIdentical).toBe(1);
    expect(result.stats.movedSpells).toBe(0);
  });

  /**
   * ÖLÇÜLDÜ: taşınacak 200 dönemin 56'sı bu sınıfta — aynı dönemin iki
   * varlıkta biraz farklı yazımı (`2001–2003` vs `2001–2004`). §4.3'ün
   * kurduğu ilke burada da geçerli: örtüşme belirsizliğin ta kendisidir ve
   * ikinci kopya §8.2'nin "örtüşen kalıcı dönem" uyarısını tetiklerdi.
   */
  it("örtüşen ama birebir olmayan dönemi ikinci kopya olarak eklemez", () => {
    const result = merge(
      [club(FB), club(FB_SK)],
      [
        // FB'yi asıl yapan şey dönem sayısı; ikinci oyuncu onun için.
        spell({ clubWikidataId: FB, playerWikidataId: "Q9" }),
        spell({ clubWikidataId: FB, startYear: 2001, endYear: 2004 }),
        spell({ clubWikidataId: FB_SK, startYear: 2001, endYear: 2003 }),
      ],
      LINK,
    );

    expect(result.spells).toHaveLength(2);
    expect(result.spells.map((s) => s.endYear)).toContain(2004);
    expect(result.spells.map((s) => s.endYear)).not.toContain(2003);
    expect(result.stats.droppedOverlapping).toBe(1);
  });

  it("örtüşme denetimi oyuncu bazındadır", () => {
    // Aynı yıllar ama BAŞKA oyuncu — çakışma değil.
    const result = merge(
      [club(FB), club(FB_SK)],
      [
        spell({ clubWikidataId: FB, playerWikidataId: "Q1" }),
        spell({ clubWikidataId: FB_SK, playerWikidataId: "Q2" }),
      ],
      LINK,
    );

    expect(result.spells).toHaveLength(2);
    expect(result.stats.movedSpells).toBe(1);
  });

  /** Bilinmeyen uç örtüşmediğini KANITLAMAZ (`merge-wikipedia` ile aynı kural). */
  it("açık uçlu dönemi örtüşen sayar", () => {
    const result = merge(
      [club(FB), club(FB_SK)],
      [
        spell({ clubWikidataId: FB, startYear: 2010, endYear: null }),
        spell({ clubWikidataId: FB_SK, startYear: 2020, endYear: 2021 }),
      ],
      LINK,
    );

    expect(result.stats.droppedOverlapping).toBe(1);
    expect(result.spells).toHaveLength(1);
  });

  it("bağ evren dışına işaret ediyorsa hiçbir şey yapmaz", () => {
    const result = merge(
      [club(FB)],
      [spell({ clubWikidataId: FB })],
      [{ clubWikidataId: FB, parentWikidataId: "Q999999" }],
    );

    expect(result.stats.mergedClubs).toBe(0);
    expect(result.clubs).toHaveLength(1);
    expect(result.spells).toHaveLength(1);
  });

  it("bağ yoksa girdiyi olduğu gibi döner", () => {
    const clubs = [club(FB), club(GS)];
    const spells = [
      spell({ clubWikidataId: FB }),
      spell({ clubWikidataId: GS }),
    ];
    const result = merge(clubs, spells, []);

    expect(result.clubs).toEqual(clubs);
    expect(result.spells).toEqual(spells);
    expect(result.stats.mergedClubs).toBe(0);
  });

  /**
   * Wikidata'da karşılıklı `P361` bağları GERÇEKTEN var; döngü koruması
   * olmasa zincir çözümü sonsuza girerdi.
   */
  it("karşılıklı bağda döngüye girmez", () => {
    const result = merge(
      [club(FB), club(FB_SK)],
      [
        spell({ clubWikidataId: FB, playerWikidataId: "Q1" }),
        spell({ clubWikidataId: FB, playerWikidataId: "Q2" }),
        spell({ clubWikidataId: FB_SK, playerWikidataId: "Q3" }),
      ],
      [
        { clubWikidataId: FB_SK, parentWikidataId: FB },
        { clubWikidataId: FB, parentWikidataId: FB_SK },
      ],
    );

    expect(result.clubs).toHaveLength(1);
    expect(result.spells).toHaveLength(3);
  });

  /** Zincir: gölge başka bir gölgeyi gösteriyor olabilir. */
  it("zinciri sonuna kadar çözer", () => {
    const A = "Q100";
    const B = "Q200";
    const C = "Q300";
    const result = merge(
      [club(A), club(B), club(C)],
      [
        spell({ clubWikidataId: A, playerWikidataId: "Q1" }),
        spell({ clubWikidataId: A, playerWikidataId: "Q2" }),
        spell({ clubWikidataId: A, playerWikidataId: "Q3" }),
        spell({ clubWikidataId: B, playerWikidataId: "Q4" }),
        spell({ clubWikidataId: B, playerWikidataId: "Q5" }),
        spell({ clubWikidataId: C, playerWikidataId: "Q6" }),
      ],
      [
        { clubWikidataId: C, parentWikidataId: B },
        { clubWikidataId: B, parentWikidataId: A },
      ],
    );

    expect(result.clubs.map((c) => c.wikidataId)).toEqual([A]);
    expect(result.spells.every((s) => s.clubWikidataId === A)).toBe(true);
    expect(result.spells).toHaveLength(6);
  });

  /** Aynı girdi aynı sonucu vermeli: kulüp kimliği koşudan koşuya sabit. */
  it("eşit dönem sayısında kararı QID sırası verir", () => {
    const links = [{ clubWikidataId: "Q200", parentWikidataId: "Q100" }];
    const build = () =>
      merge(
        [club("Q100"), club("Q200")],
        [
          spell({ clubWikidataId: "Q100", playerWikidataId: "Q1" }),
          spell({ clubWikidataId: "Q200", playerWikidataId: "Q2" }),
        ],
        links,
      );

    expect(build().clubs.map((c) => c.wikidataId)).toEqual(["Q100"]);
    expect(build().clubs).toEqual(build().clubs);
  });
});
