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
  nationalGoals: null,
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

describe("BR-42 — çapraz kaynak kapısı", () => {
  const fetchedClubIds = new Set(["QA"]);

  const celiski = {
    playerWikidataId: "Q30055335",
    spellId: "Q30055335-390ce6af",
    clubWikidataId: "Q8682",
    startYear: 2019,
    endYear: null,
    appearances: 227,
    wikipediaClubs: ["Q1543"],
  };

  it("TEK BİR çelişki bile yüklemeyi durdurur", () => {
    // Oran değil SAYI: 78 bin dönemde tek bir vandalizm hiçbir oranı eşiğin
    // üstüne çıkarmaz, ama kullanıcı onu oyun içinde görür — nitekim gördü.
    const report = validateDataset({
      clubs: [club("QA")],
      spells: [spell("s1")],
      rejected: [],
      fetchedClubIds,
      contradictions: [celiski],
    });

    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain("BR-42");
  });

  it("hata mesajı İFADE KİMLİĞİNİ taşır", () => {
    // İnceleme ancak kimlikle yapılabilir: kayıt Wikidata'da tek tek açılıp
    // geçmişine bakılacak. Kimliksiz bir uyarı "bir yerde bir sorun var" der.
    const report = validateDataset({
      clubs: [club("QA")],
      spells: [spell("s1")],
      rejected: [],
      fetchedClubIds,
      contradictions: [celiski],
    });

    expect(report.errors[0]).toContain("Q30055335-390ce6af");
    expect(report.errors[0]).toContain("Q8682");
    expect(report.errors[0]).toContain("Q1543");
  });

  it("çelişki yoksa sessizdir", () => {
    const report = validateDataset({
      clubs: [club("QA")],
      spells: [spell("s1")],
      rejected: [],
      fetchedClubIds,
      contradictions: [],
    });

    expect(report.errors).toHaveLength(0);
  });

  it("alan HİÇ verilmezse sessizdir", () => {
    // `--skip-wikipedia` koşusunda ikinci kaynak yoktur; "çelişki yok" ile
    // "sorulamadı" karıştırılmamalı (§2.7).
    const report = validateDataset({
      clubs: [club("QA")],
      spells: [spell("s1")],
      rejected: [],
      fetchedClubIds,
    });

    expect(report.errors).toHaveLength(0);
  });
});

describe("örtüşen kalıcı dönem — açık uçlu olanlar dâhil", () => {
  const fetchedClubIds = new Set(["QA", "QB"]);

  it("İKİSİ DE SÜREN iki dönem örtüşme sayılır", () => {
    // Kapatılan boşluk: Leão'nun vandalize edilmiş kaydında Real Madrid ve
    // Milan dönemlerinin ikisi de sürüyordu ve eski kural `endYear` dolu
    // olmasını şart koştuğu için hiç uyarı basmadı.
    const report = validateDataset({
      clubs: [club("QA"), club("QB")],
      spells: [
        spell("s1", {
          clubWikidataId: "QA",
          startYear: 2019,
          endYear: null,
          isCurrent: true,
        }),
        spell("s2", {
          clubWikidataId: "QB",
          startYear: 2019,
          endYear: null,
          isCurrent: true,
        }),
      ],
      rejected: [],
      fetchedClubIds,
    });

    expect(
      report.warnings.some((w) => w.includes("örtüşen kalıcı dönem")),
    ).toBe(true);
  });

  it("BİTİŞİ BİLİNMEYEN dönem örtüşme SAYILMAZ", () => {
    // `isCurrent = false` + `endYear = null` "bitişi bilinmiyor" demek (§5.1).
    // Ölçüldü: böyle ikinci bir kalıcı dönemi olan 3.588 oyuncu var; hepsini
    // örtüşme saymak uyarıyı okunmaz hâle getirirdi.
    const report = validateDataset({
      clubs: [club("QA"), club("QB")],
      spells: [
        spell("s1", { clubWikidataId: "QA", startYear: 2019, endYear: null }),
        spell("s2", { clubWikidataId: "QB", startYear: 2019, endYear: null }),
      ],
      rejected: [],
      fetchedClubIds,
    });

    expect(
      report.warnings.some((w) => w.includes("örtüşen kalıcı dönem")),
    ).toBe(false);
  });

  it("SINIRA DEĞEN iki dönem örtüşme sayılmaz", () => {
    // Normal transfer: 2016–2019 ve 2019–2022 aynı sezonu paylaşmaz.
    const report = validateDataset({
      clubs: [club("QA"), club("QB")],
      spells: [
        spell("s1", { clubWikidataId: "QA", startYear: 2016, endYear: 2019 }),
        spell("s2", { clubWikidataId: "QB", startYear: 2019, endYear: 2022 }),
      ],
      rejected: [],
      fetchedClubIds,
    });

    expect(
      report.warnings.some((w) => w.includes("örtüşen kalıcı dönem")),
    ).toBe(false);
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
