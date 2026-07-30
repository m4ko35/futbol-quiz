import { describe, expect, it } from "vitest";
import { findCommonPlayers } from "@/domain/services/common-players";
import {
  DEFAULT_SPELL_FILTER,
  type SpellFilter,
} from "@/domain/services/spell-filter";
import { clubId } from "@/domain/value-objects/identifiers";
import { aPlayer, aSpell } from "../../helpers/builders";

/**
 * BR-1, BR-2, BR-3 ve BR-5'in doğrudan testleri (PROJECT.md §5.4).
 */

const CLUB_A = clubId("clubA");
const CLUB_B = clubId("clubB");
const CLUB_C = clubId("clubC");

function run(
  candidates: Parameters<typeof findCommonPlayers>[0]["candidates"],
  filter: SpellFilter = DEFAULT_SPELL_FILTER,
) {
  return findCommonPlayers({
    clubA: CLUB_A,
    clubB: CLUB_B,
    candidates,
    filter,
  });
}

describe("BR-1 — ortak oyuncu tanımı", () => {
  it("iki kulüpte de dönemi olan oyuncuyu bulur", () => {
    const player = aPlayer({ name: "Ortak Oyuncu" });

    const result = run([
      {
        player,
        spells: [
          aSpell({ clubId: CLUB_A, years: { start: 2010, end: 2012 } }),
          aSpell({ clubId: CLUB_B, years: { start: 2013, end: 2015 } }),
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.player.name).toBe("Ortak Oyuncu");
    expect(result[0]?.spellsAtA).toHaveLength(1);
    expect(result[0]?.spellsAtB).toHaveLength(1);
  });

  it("yalnızca tek kulüpte oynayanı elemektedir", () => {
    const result = run([
      {
        player: aPlayer(),
        spells: [aSpell({ clubId: CLUB_A })],
      },
    ]);

    expect(result).toHaveLength(0);
  });

  it("dönemlerin zaman olarak örtüşmesini ŞART KOŞMAZ", () => {
    // Kuralın en çok yanlış anlaşılan yanı. "Ortak" burada "aynı anda" değil,
    // "her ikisinde de bir zaman" demektir; zaten aynı anda iki kulüpte
    // olunamaz. Bir örtüşme koşulu eklenirse sonuç HER ZAMAN boş dönerdi.
    const result = run([
      {
        player: aPlayer(),
        spells: [
          aSpell({ clubId: CLUB_A, years: { start: 1998, end: 2001 } }),
          aSpell({ clubId: CLUB_B, years: { start: 2014, end: 2016 } }),
        ],
      },
    ]);

    expect(result).toHaveLength(1);
  });

  it("aynı kulüpteki birden çok dönemi tek oyuncuda toplar", () => {
    // Kiralık dönüşü ve yıllar sonraki geri dönüş gerçek bir olgu; oyuncu
    // listede iki kez görünmemeli, dönemleri yan yana durmalı.
    const result = run([
      {
        player: aPlayer(),
        spells: [
          aSpell({ clubId: CLUB_A, years: { start: 2008, end: 2010 } }),
          aSpell({ clubId: CLUB_A, years: { start: 2015, end: 2017 } }),
          aSpell({ clubId: CLUB_B, years: { start: 2010, end: 2015 } }),
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.spellsAtA).toHaveLength(2);
  });

  it("üçüncü kulüpteki dönemleri sonuca sızdırmaz", () => {
    const result = run([
      {
        player: aPlayer(),
        spells: [
          aSpell({ clubId: CLUB_A }),
          aSpell({ clubId: CLUB_B }),
          aSpell({ clubId: CLUB_C }),
        ],
      },
    ]);

    expect(result[0]?.spellsAtA).toHaveLength(1);
    expect(result[0]?.spellsAtB).toHaveLength(1);
  });

  it("birden çok tarihsiz dönemi birlikte sona atar", () => {
    // Tarihsiz–tarihsiz karşılaştırması ayrı bir daldır; iki tanesi yan yana
    // olduğunda sıralayıcının kararlı davrandığını da doğrular.
    const result = run([
      {
        player: aPlayer(),
        spells: [
          aSpell({ clubId: CLUB_A, years: { start: null, end: null } }),
          aSpell({ clubId: CLUB_A, years: { start: 2001, end: 2003 } }),
          aSpell({ clubId: CLUB_A, years: { start: null, end: null } }),
          aSpell({ clubId: CLUB_B }),
        ],
      },
    ]);

    expect(result[0]?.spellsAtA.map((s) => s.years.start)).toEqual([
      2001,
      null,
      null,
    ]);
  });

  it("dönemleri kronolojik sıralar, tarihsizi sona atar", () => {
    const result = run([
      {
        player: aPlayer(),
        spells: [
          aSpell({ clubId: CLUB_A, years: { start: null, end: null } }),
          aSpell({ clubId: CLUB_A, years: { start: 2015, end: 2017 } }),
          aSpell({ clubId: CLUB_A, years: { start: 2008, end: 2010 } }),
          aSpell({ clubId: CLUB_B }),
        ],
      },
    ]);

    expect(result[0]?.spellsAtA.map((s) => s.years.start)).toEqual([
      2008,
      2015,
      null,
    ]);
  });
});

describe("BR-2 — altyapı dönemleri", () => {
  const candidate = {
    player: aPlayer(),
    spells: [
      aSpell({ clubId: CLUB_A, isYouth: true }),
      aSpell({ clubId: CLUB_B, isYouth: false }),
    ],
  };

  it("varsayılan olarak sayılmaz — ortaklık oluşmaz", () => {
    expect(run([candidate])).toHaveLength(0);
  });

  it("includeYouth açıkken sayılır", () => {
    const result = run([candidate], {
      includeYouth: true,
      includeLoans: true,
    });

    expect(result).toHaveLength(1);
  });
});

describe("BR-3 — kiralık dönemler", () => {
  const candidate = {
    player: aPlayer(),
    spells: [
      aSpell({ clubId: CLUB_A, isLoan: true }),
      aSpell({ clubId: CLUB_B, isLoan: false }),
    ],
  };

  it("varsayılan olarak SAYILIR", () => {
    const result = run([candidate]);

    expect(result).toHaveLength(1);
    // Rozet gösterilebilmesi için işaret sonuca kadar taşınır.
    expect(result[0]?.spellsAtA[0]?.isLoan).toBe(true);
  });

  it("includeLoans kapatıldığında elenir", () => {
    const result = run([candidate], {
      includeYouth: false,
      includeLoans: false,
    });

    expect(result).toHaveLength(0);
  });
});

describe("BR-5 — sıralama", () => {
  it("maç sayısı toplamına göre azalan sıralar", () => {
    const result = run([
      {
        player: aPlayer({ name: "Az Oynayan" }),
        spells: [
          aSpell({ clubId: CLUB_A, appearances: 5 }),
          aSpell({ clubId: CLUB_B, appearances: 3 }),
        ],
      },
      {
        player: aPlayer({ name: "Çok Oynayan" }),
        spells: [
          aSpell({ clubId: CLUB_A, appearances: 200 }),
          aSpell({ clubId: CLUB_B, appearances: 100 }),
        ],
      },
    ]);

    expect(result.map((r) => r.player.name)).toEqual([
      "Çok Oynayan",
      "Az Oynayan",
    ]);
    expect(result[0]?.totalAppearances).toBe(300);
  });

  it("maç bilgisi olanları, olmayanların önüne koyar", () => {
    const result = run([
      {
        player: aPlayer({ name: "Bilinmeyen" }),
        spells: [
          aSpell({ clubId: CLUB_A, appearances: null }),
          aSpell({ clubId: CLUB_B, appearances: null }),
        ],
      },
      {
        player: aPlayer({ name: "Bilinen" }),
        spells: [
          aSpell({ clubId: CLUB_A, appearances: 1 }),
          aSpell({ clubId: CLUB_B, appearances: null }),
        ],
      },
    ]);

    expect(result.map((r) => r.player.name)).toEqual(["Bilinen", "Bilinmeyen"]);
  });

  it("maç bilgisi yoksa en son yıla göre azalan sıralar", () => {
    const result = run([
      {
        player: aPlayer({ name: "Eski" }),
        spells: [
          aSpell({ clubId: CLUB_A, years: { start: 1990, end: 1992 } }),
          aSpell({ clubId: CLUB_B, years: { start: 1993, end: 1995 } }),
        ],
      },
      {
        player: aPlayer({ name: "Yeni" }),
        spells: [
          aSpell({ clubId: CLUB_A, years: { start: 2018, end: 2020 } }),
          aSpell({ clubId: CLUB_B, years: { start: 2021, end: 2023 } }),
        ],
      },
    ]);

    expect(result.map((r) => r.player.name)).toEqual(["Yeni", "Eski"]);
    expect(result[0]?.latestYear).toBe(2023);
  });

  it("yılı da bilinmeyeni en sona koyar", () => {
    const result = run([
      {
        player: aPlayer({ name: "Yılsız" }),
        spells: [
          aSpell({ clubId: CLUB_A, years: { start: null, end: null } }),
          aSpell({ clubId: CLUB_B, years: { start: null, end: null } }),
        ],
      },
      {
        player: aPlayer({ name: "Yıllı" }),
        spells: [
          aSpell({ clubId: CLUB_A, years: { start: 1970, end: 1971 } }),
          aSpell({ clubId: CLUB_B, years: { start: 1972, end: 1973 } }),
        ],
      },
    ]);

    expect(result.map((r) => r.player.name)).toEqual(["Yıllı", "Yılsız"]);
  });

  it("tam eşitlikte ada göre Türkçe sıralar — sonuç tekrarlanabilirdir", () => {
    // Belirsiz sıralama, aynı isteğin iki farklı yanıt vermesi demektir:
    // sayfalama ve test tekrarlanabilirliği bunun üstünde durur.
    const names = ["Şahin", "Serkan", "Çağlar", "Ali"];
    const result = run(
      names.map((name) => ({
        player: aPlayer({ name }),
        spells: [
          aSpell({ clubId: CLUB_A, appearances: 10 }),
          aSpell({ clubId: CLUB_B, appearances: 10 }),
        ],
      })),
    );

    expect(result.map((r) => r.player.name)).toEqual([
      "Ali",
      "Çağlar",
      "Serkan",
      "Şahin",
    ]);
  });
});

describe("maç sayısı toplamı", () => {
  it("bilinen değerleri toplar, bilinmeyeni 0 saymaz", () => {
    const result = run([
      {
        player: aPlayer(),
        spells: [
          aSpell({ clubId: CLUB_A, appearances: 40 }),
          aSpell({ clubId: CLUB_A, appearances: null }),
          aSpell({ clubId: CLUB_B, appearances: 2 }),
        ],
      },
    ]);

    expect(result[0]?.totalAppearances).toBe(42);
  });

  it("hiçbir dönemde maç bilgisi yoksa null verir — 0 değil", () => {
    // Ayrım BR-5 için belirleyici: "0 maç oynadı" bilinen bir olgu,
    // "bilinmiyor" ise bilgisizlik. İkisi sıralamada farklı davranır.
    const result = run([
      {
        player: aPlayer(),
        spells: [
          aSpell({ clubId: CLUB_A, appearances: null }),
          aSpell({ clubId: CLUB_B, appearances: null }),
        ],
      },
    ]);

    expect(result[0]?.totalAppearances).toBeNull();
  });

  it("gerçekten 0 maç oynanmışsa 0 verir", () => {
    const result = run([
      {
        player: aPlayer(),
        spells: [
          aSpell({ clubId: CLUB_A, appearances: 0 }),
          aSpell({ clubId: CLUB_B, appearances: 0 }),
        ],
      },
    ]);

    expect(result[0]?.totalAppearances).toBe(0);
  });
});

describe("kenar durumlar", () => {
  it("aday yoksa boş liste döner", () => {
    expect(run([])).toEqual([]);
  });

  it("dönemi olmayan adayı eler", () => {
    expect(run([{ player: aPlayer(), spells: [] }])).toHaveLength(0);
  });
});
