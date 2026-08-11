import { describe, expect, it } from "vitest";

import type {
  NormalizedClub,
  NormalizedPlayer,
  NormalizedSpell,
} from "../../../scripts/etl/pipeline/normalize";
import {
  sanitizeSpells,
  validateDataset,
} from "../../../scripts/etl/pipeline/validate";

const club = (
  id: string,
  foundedYear: number | null = 1900,
): NormalizedClub => ({
  wikidataId: id,
  name: `Kulüp ${id}`,
  shortName: `Kulüp ${id}`,
  searchKey: `kulup ${id}`,
  country: "TR",
  foundedYear,
  crestUrl: null,
  leagueWikidataId: null,
});

const player = (id: string): NormalizedPlayer => ({
  wikidataId: id,
  name: `Oyuncu ${id}`,
  searchKey: `oyuncu ${id}`,
  birthDate: null,
  nationality: null,
  citizenships: [],
  birthCountry: null,
  position: null,
  genderQid: null,
  nationalCaps: null,
  heightCm: null,
  weightKg: null,
});

const spell = (
  id: string,
  overrides: Partial<NormalizedSpell> = {},
): NormalizedSpell => ({
  wikidataStatementId: id,
  playerWikidataId: "Q1",
  clubWikidataId: "QA",
  startYear: 2010,
  endYear: 2012,
  isCurrent: false,
  isLoan: false,
  isYouth: false,
  appearances: null,
  goals: null,
  ...overrides,
});

const base = { clubs: [club("QA")], players: [player("Q1")] };

describe("sanitizeSpells", () => {
  it("tutarlı kaydı korur", () => {
    const result = sanitizeSpells({ ...base, spells: [spell("s1")] });

    expect(result.spells).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  it("bitişi başlangıcından önce olan kaydı atar", () => {
    const result = sanitizeSpells({
      ...base,
      spells: [spell("s1", { startYear: 2007, endYear: 2000 })],
    });

    expect(result.spells).toHaveLength(0);
    expect(result.rejected[0]?.reason).toContain("başlangıç bitişten sonra");
  });

  it("makul olmayan yılı atar", () => {
    // Wikidata'da gerçekten görülen değerler: 2077 ve 2624.
    const result = sanitizeSpells({
      ...base,
      spells: [
        spell("s1", { startYear: 2077, endYear: null }),
        spell("s2", { startYear: 2624, endYear: null }),
      ],
    });

    expect(result.spells).toHaveLength(0);
    expect(result.rejected).toHaveLength(2);
  });

  it("oyuncusu veya kulübü çekilememiş kaydı atar", () => {
    const result = sanitizeSpells({
      ...base,
      spells: [
        spell("s1", { playerWikidataId: "Q_yok" }),
        spell("s2", { clubWikidataId: "Q_yok" }),
      ],
    });

    expect(result.spells).toHaveLength(0);
    expect(result.rejected.map((r) => r.reason)).toEqual([
      "oyuncu bilgisi çekilemedi",
      "kulüp bilgisi çekilemedi",
    ]);
  });

  it("tarihi bilinmeyen kaydı atmaz", () => {
    // Eksik tarih bir çelişki değil; kayıt hâlâ "bu kulüpte oynadı" bilgisini
    // taşır ve ortak oyuncu sorgusu için yeterlidir (§2.7).
    const result = sanitizeSpells({
      ...base,
      spells: [spell("s1", { startYear: null, endYear: null })],
    });

    expect(result.spells).toHaveLength(1);
  });
});

describe("validateDataset — ayıklama oranı", () => {
  const fetchedClubIds = new Set(["QA"]);

  it("düşük oranda ayıklamayı uyarı sayar, yüklemeyi engellemez", () => {
    // 1000 kayıttan 1'i atıldı: %0.1 — kaynaktaki yazım hatası.
    const spells = Array.from({ length: 999 }, (_, i) => spell(`s${i}`));
    const report = validateDataset({
      clubs: [club("QA")],
      spells,
      rejected: [
        { id: "kotu", reason: "başlangıç bitişten sonra (2007 → 2000)" },
      ],
      fetchedClubIds,
    });

    expect(report.errors).toHaveLength(0);
    expect(report.warnings.some((w) => w.includes("ayıklandı"))).toBe(true);
  });

  it("yüksek oranda ayıklamayı bloklayıcı hata sayar", () => {
    // 10 kayıttan 5'i atıldı: %50 — bu artık yazım hatası değil, çıkarım
    // sürecinde sistemik bir sorun.
    const spells = Array.from({ length: 5 }, (_, i) => spell(`s${i}`));
    const rejected = Array.from({ length: 5 }, (_, i) => ({
      id: `bad${i}`,
      reason: "oyuncu bilgisi çekilemedi",
    }));

    const report = validateDataset({
      clubs: [club("QA")],
      spells,
      rejected,
      fetchedClubIds,
    });

    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain("sistemik");
  });

  it("kuruluş öncesi dönemi uyarır ama engellemez", () => {
    const report = validateDataset({
      clubs: [club("QA", 1892)],
      spells: [spell("s1", { startYear: 1891, endYear: 1893 })],
      rejected: [],
      fetchedClubIds,
    });

    expect(report.errors).toHaveLength(0);
    expect(report.warnings.some((w) => w.includes("kuruluşundan önce"))).toBe(
      true,
    );
  });

  it("çekilmemiş kulüpler için 'az dönem' uyarısı üretmez", () => {
    // Kısmi koşuda (--max-clubs) sorgulanmamış kulüp boş görünür; bu bir
    // veri sorunu değildir.
    const report = validateDataset({
      clubs: [club("QA"), club("QB")],
      spells: Array.from({ length: 60 }, (_, i) => spell(`s${i}`)),
      rejected: [],
      fetchedClubIds: new Set(["QA"]),
    });

    expect(report.warnings.some((w) => w.includes("az dönem"))).toBe(false);
  });
});
