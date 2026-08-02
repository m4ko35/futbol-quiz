import { describe, expect, it } from "vitest";

import type { NormalizedSpell } from "../../../scripts/etl/pipeline/normalize";
import {
  mergeOverrides,
  overrideStatementId,
  readOverrideSpells,
  type OverrideSpell,
} from "../../../scripts/etl/pipeline/overrides";
import { sanitizeSpells } from "../../../scripts/etl/pipeline/validate";

/**
 * Elle düzeltmeler — PROJECT.md §8.2.
 *
 * Bu mekanizma veri kümesine ELLE veri sokar; en tehlikeli özelliği de budur.
 * Testler tek bir soruyu kovalıyor: kaynağı sessizce ezebilir mi?
 */

const override = (overrides: Partial<OverrideSpell> = {}): OverrideSpell => ({
  player: "Q318069",
  club: "Q495299",
  startYear: 2022,
  endYear: null,
  isLoan: false,
  note: "test gerekçesi — en az on karakter",
  ...overrides,
});

const wikidataSpell = (
  overrides: Partial<NormalizedSpell> = {},
): NormalizedSpell => ({
  wikidataStatementId: "Q318069-AD66DA21-C0D1-4D66-90B7-676566585715",
  playerWikidataId: "Q318069",
  clubWikidataId: "Q495299",
  startYear: 2022,
  endYear: null,
  isCurrent: true,
  isLoan: false,
  isYouth: false,
  appearances: 40,
  goals: 3,
  ...overrides,
});

describe("mergeOverrides", () => {
  it("kaynakta olmayan dönemi ekler", () => {
    const result = mergeOverrides([], [override()]);

    expect(result.added).toBe(1);
    expect(result.redundant).toHaveLength(0);
    expect(result.spells[0]).toMatchObject({
      playerWikidataId: "Q318069",
      clubWikidataId: "Q495299",
      startYear: 2022,
    });
  });

  /**
   * MEKANİZMANIN EN ÖNEMLİ KURALI. Wikidata aynı dönemi taşıyorsa elle kayıt
   * YOK SAYILIR. Ezseydi, kaynaktaki bir düzeltme burada sessizce geri
   * alınır ve ETL her koşuda aynı yanlışı yeniden üretirdi.
   */
  it("Wikidata aynı dönemi taşıyorsa üzerine YAZMAZ", () => {
    const source = wikidataSpell();

    const result = mergeOverrides([source], [override()]);

    expect(result.added).toBe(0);
    expect(result.spells).toHaveLength(1);
    expect(result.spells[0]).toBe(source);
  });

  /** Gereksizleşen kayıt raporlanır; dosya sessizce şişmesin (§8.2). */
  it("gereksizleşen override'ı raporlar", () => {
    const result = mergeOverrides([wikidataSpell()], [override()]);

    expect(result.redundant).toHaveLength(1);
    expect(result.redundant[0]?.player).toBe("Q318069");
  });

  /**
   * KOPYA TUZAĞI. Yılsız override "bu oyuncu bu kulüpte oynadı" der; kaynak
   * aynı dönemi YILIYLA taşıyorsa üçlü anahtarda eşleşmez ve iki kayıt
   * oluşurdu. Wikidata kadro boşluklarını sürekli dolduruyor, yani bu durum
   * er geç oluşur.
   */
  it("yılsız override, yılı olan kaynak kaydını gereksiz sayar", () => {
    const result = mergeOverrides(
      [wikidataSpell({ startYear: 2025 })],
      [override({ startYear: null })],
    );

    expect(result.added).toBe(0);
    expect(result.redundant).toHaveLength(1);
    expect(result.spells).toHaveLength(1);
  });

  it("yılsız override, başka kulüpteki kaydı gereksiz SAYMAZ", () => {
    const result = mergeOverrides(
      [wikidataSpell({ clubWikidataId: "Q513840" })],
      [override({ startYear: null })],
    );

    expect(result.added).toBe(1);
  });

  it("farklı yıl ayrı bir dönemdir", () => {
    const result = mergeOverrides(
      [wikidataSpell({ startYear: 2019 })],
      [override({ startYear: 2022 })],
    );

    expect(result.added).toBe(1);
    expect(result.spells).toHaveLength(2);
  });

  /** Maç/gol UYDURULMAZ (§2.7); sonucu BR-15 adaylığından düşmektir. */
  it("maç ve gol sayısını boş bırakır", () => {
    const result = mergeOverrides([], [override()]);

    expect(result.spells[0]?.appearances).toBeNull();
    expect(result.spells[0]?.goals).toBeNull();
  });

  /** Elle düzeltmeler A takım boşluğu içindir; altyapı sayılmaz (BR-2). */
  it("altyapı olarak işaretlemez", () => {
    const result = mergeOverrides([], [override()]);

    expect(result.spells[0]?.isYouth).toBe(false);
  });

  it("bitişi olmayan dönemi süregelen sayar", () => {
    const result = mergeOverrides([], [override({ endYear: null })]);

    expect(result.spells[0]?.isCurrent).toBe(true);
  });

  it("yılı bilinmeyen dönem süregelen SAYILMAZ", () => {
    const result = mergeOverrides([], [override({ startYear: null })]);

    expect(result.spells[0]?.isCurrent).toBe(false);
  });
});

describe("overrideStatementId", () => {
  /**
   * Wikidata ifade kimlikleri `Q…-<UUID>` biçiminde. Önek çakışmayı
   * imkânsız kılar — yoksa elle kayıt gerçek bir ifadeyi ezebilirdi.
   */
  it("Wikidata biçimiyle çakışmaz", () => {
    expect(overrideStatementId(override())).toBe(
      "override-Q318069-Q495299-2022",
    );
  });

  /** Deterministik olmalı: yükleme idempotent kalsın. */
  it("aynı girdi için aynı kimliği üretir", () => {
    expect(overrideStatementId(override())).toBe(
      overrideStatementId(override()),
    );
  });
});

describe("ayıklama adımıyla birlikte", () => {
  const club = {
    wikidataId: "Q495299",
    name: "Galatasaray",
    shortName: "Galatasaray",
    searchKey: "galatasaray",
    country: "TR",
    foundedYear: 1905,
    crestUrl: null,
    leagueWikidataId: null,
  };
  const player = {
    wikidataId: "Q318069",
    name: "Abdülkerim Bardakçı",
    searchKey: "abdulkerim bardakci",
    birthDate: null,
    nationality: "TR",
    position: "Defans",
    genderQid: null,
    nationalCaps: null,
    heightCm: null,
    weightKg: null,
  };

  /** Override'ın ayrıcalığı yoktur; aynı kapıdan geçer. */
  it("override kaydı ayıklamadan sağ çıkar", () => {
    const { spells } = mergeOverrides([], [override()]);

    const result = sanitizeSpells({
      clubs: [club],
      players: [player],
      spells,
    });

    expect(result.rejected).toHaveLength(0);
    expect(result.spells).toHaveLength(1);
  });

  /**
   * EN ÖNEMLİ BAŞARISIZLIK BİÇİMİ. Oyuncunun meta verisi çekilemezse override
   * sessizce düşer ve ETL yine de "başarılı" biter — düzelttiğimizi sandığımız
   * hata yerinde kalır. `db:verify`'daki `verifyOverrides` bunu yakalamak için
   * var; burada o senaryonun gerçekten oluştuğu kanıtlanıyor.
   */
  it("oyuncu meta verisi yoksa SESSİZCE düşer", () => {
    const { spells } = mergeOverrides([], [override()]);

    const result = sanitizeSpells({ clubs: [club], players: [], spells });

    expect(result.spells).toHaveLength(0);
    expect(result.rejected[0]?.reason).toContain("oyuncu");
  });

  it("kulüp evrende yoksa düşer", () => {
    const { spells } = mergeOverrides([], [override()]);

    const result = sanitizeSpells({ clubs: [], players: [player], spells });

    expect(result.rejected[0]?.reason).toContain("kulüp");
  });
});

describe("spells.json — gerçek dosya", () => {
  /**
   * Dosyanın kendisi şemadan geçmeli. Bozuk bir JSON'u ancak ETL koşarken
   * fark etmek, saatler süren bir çekimin sonunda durmak demek olurdu.
   */
  it("şemayı geçer", async () => {
    await expect(readOverrideSpells()).resolves.toBeInstanceOf(Array);
  });

  it("her kaydın gerekçesi vardır", async () => {
    const spells = await readOverrideSpells();

    for (const spell of spells) {
      expect(spell.note.length).toBeGreaterThanOrEqual(10);
    }
  });

  /** Kimlikler benzersiz olmalı; `readOverrideSpells` bunu zorlar. */
  it("yinelenen kayıt içermez", async () => {
    const spells = await readOverrideSpells();
    const ids = spells.map(overrideStatementId);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
