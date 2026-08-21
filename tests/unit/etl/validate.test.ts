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
    wikipediaSites: ["tr", "en"] as const,
  };

  it("tekil çelişki UYARIDIR, yüklemeyi durdurmaz", () => {
    // 21 Ağustos 2026'da değişti. Kural "tek çelişkide dur" diye konmuştu ve
    // ölçülen bedeli şuydu: kapı 12 Ağustos'tan beri kapalıydı ve o gün
    // yüklenen veri kümesi Leão'nun vandalize edilmiş kaydını taşıyordu.
    // Yani kural, korumaya çalıştığı şeyin tersini yapıyordu.
    const report = validateDataset({
      clubs: [club("QA")],
      spells: [spell("s1")],
      rejected: [],
      fetchedClubIds,
      contradictions: [celiski],
    });

    expect(report.errors).toEqual([]);
    expect(report.warnings.some((w) => w.includes("BR-42"))).toBe(true);
  });

  it("BÜTÇEYİ AŞAN sayı yüklemeyi durdurur", () => {
    // Bütçe sistemik bozulmayı ölçer: bir korumanın sessizce devre dışı
    // kalması sayıyı 85'ten 341'e çıkarıyor (ölçüldü). 151 satır o dünyanın
    // içinde ve durmalı.
    const cok = Array.from({ length: 151 }, (_, i) => ({
      ...celiski,
      spellId: `Q${String(i)}-abc`,
    }));

    const report = validateDataset({
      clubs: [club("QA")],
      spells: [spell("s1")],
      rejected: [],
      fetchedClubIds,
      contradictions: cok,
    });

    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toContain("BÜTÇEYİ AŞTI");
  });

  it("uyarı mesajı İFADE KİMLİĞİNİ taşır", () => {
    // İnceleme ancak kimlikle yapılabilir: kayıt Wikidata'da tek tek açılıp
    // geçmişine bakılacak. Kimliksiz bir uyarı "bir yerde bir sorun var" der.
    const report = validateDataset({
      clubs: [club("QA")],
      spells: [spell("s1")],
      rejected: [],
      fetchedClubIds,
      contradictions: [celiski],
    });

    const uyari = report.warnings.find((w) => w.includes("BR-42")) ?? "";
    expect(uyari).toContain("Q30055335-390ce6af");
    expect(uyari).toContain("Q8682");
    expect(uyari).toContain("Q1543");
  });

  /**
   * KIRPILMA GÜNLÜĞE AİT, RAPORA DEĞİL — 20 Ağustos 2026 koşusunun dersi.
   *
   * O koşu 383 çelişkiyle durdu ve günlük yalnızca 8'ini bastı; kapının kendi
   * reçetesi ("her biri elle incelenmeli") kendi çıktısıyla uygulanamıyordu.
   * Bu test kırpmanın geri gelmesini engelliyor.
   */
  it("TAM listeyi detayda taşır, günlük özetini kırpsa bile", () => {
    const cok = Array.from({ length: 20 }, (_, i) => ({
      ...celiski,
      playerWikidataId: `Q${String(i)}`,
      spellId: `Q${String(i)}-abc`,
    }));

    const report = validateDataset({
      clubs: [club("QA")],
      spells: [spell("s1")],
      rejected: [],
      fetchedClubIds,
      contradictions: cok,
    });

    // Günlük kırpıyor…
    expect(report.warnings.find((w) => w.includes("BR-42"))).toContain("+12");

    // …rapor kırpmıyor.
    const detay = report.details.find((d) => d.key === "br42-celiskiler");
    expect(detay?.items).toHaveLength(20);
    expect(detay?.header).toContain("ifade");
    // Son satır da orada: kırpma sınırının ötesindeki kayıt kaybolmamalı.
    expect(detay?.items.at(-1)).toContain("Q19-abc");
  });

  /**
   * 4. koruma — karar verilemeyen kayıt BLOKLAMAZ (§8.2, 21 Ağustos 2026).
   *
   * Ayrım burada tutuluyor çünkü karıştırılması pahalı: "iki kaynak
   * anlaşamıyor" yüklemeyi durdurur, "ikinci kaynağı okuyamadık" durdurmaz.
   * İkincisi bir veri kusuru değil, bizim kör noktamız.
   */
  const kararsiz = {
    ...celiski,
    unreadTitles: ["AEK Athens F.C."],
  };

  it("karar verilemeyen kayıt UYARI üretir, hata değil", () => {
    const report = validateDataset({
      clubs: [club("QA")],
      spells: [spell("s1")],
      rejected: [],
      fetchedClubIds,
      contradictions: [],
      undecided: [kararsiz],
    });

    expect(report.errors).toEqual([]);
    expect(report.warnings.some((w) => w.includes("karar veremedi"))).toBe(
      true,
    );
  });

  it("karar verilemeyen kayıt AYRI dosyaya yazılır ve okunamayan adı taşır", () => {
    // Bu sütun işin devamı: indekse eklenecek takma ad tam olarak bu.
    const report = validateDataset({
      clubs: [club("QA")],
      spells: [spell("s1")],
      rejected: [],
      fetchedClubIds,
      contradictions: [],
      undecided: [kararsiz],
    });

    const detay = report.details.find((d) => d.key === "br42-karar-verilemedi");
    expect(detay?.items).toHaveLength(1);
    expect(detay?.items[0]).toContain("AEK Athens F.C.");
    expect(detay?.header).toContain("okunamayan");
    // Çelişki dosyasına KARIŞMIYOR — iki liste iki ayrı iş.
    expect(report.details.some((d) => d.key === "br42-celiskiler")).toBe(false);
  });

  it("çelişki yoksa detay da üretmez", () => {
    const report = validateDataset({
      clubs: [club("QA")],
      spells: [spell("s1")],
      rejected: [],
      fetchedClubIds,
      contradictions: [],
    });

    expect(report.details.some((d) => d.key === "br42-celiskiler")).toBe(false);
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
