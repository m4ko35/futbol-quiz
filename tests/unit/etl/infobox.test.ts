import { describe, expect, it } from "vitest";

import {
  findInfobox,
  looksLikeLoan,
  parseClubLink,
  parseInfoboxSpells,
  parseTally,
  parseYearRange,
} from "../../../scripts/etl/sources/wikipedia/infobox";
import {
  BARDAKCI_INFOBOX,
  BERTRAND_INFOBOX,
  FRESIA_INFOBOX,
} from "../../fixtures/wikipedia-infoboxes";

/**
 * Vikipedi bilgi kutusu ayrıştırıcısı — PROJECT.md §4.3.
 *
 * Fikstürler GERÇEK makale metinleridir (bkz. fixtures/wikipedia-infoboxes.ts).
 * Elle yazılmış temiz bir wikitext yalnızca ayrıştırıcının kendi varsayımlarını
 * doğrular; bu testlerin yakaladığı hataların çoğu (aynı satıra sıkıştırılmış
 * alanlar, `?` maç sayısı, ASCII tire) yalnızca gerçek metinde görünüyordu.
 */

describe("parseInfoboxSpells — Türkçe şema", () => {
  const spells = parseInfoboxSpells(BARDAKCI_INFOBOX);

  it("yalnızca A takımı dönemlerini okur", () => {
    // Kutuda 8 `kulüpN`, 2 `altyapıkulübüN`, 6 `millitakımN` var.
    expect(spells).toHaveLength(8);
  });

  /**
   * BR-2 — altyapı ve millî takım okunmaz (§4.3, 6. kural). Alan adları TAM
   * eşleştiği için bu kural kendiliğinden sağlanır, ama kuralın kendisi test
   * edilmeli: önek eşleşmesine dönülürse sessizce bozulur.
   */
  it("altyapı kulüplerini almaz", () => {
    const titles = spells.map((s) => s.clubTitle);
    expect(titles).not.toContain("Fenerspor");
  });

  it("millî takımları almaz", () => {
    const titles = spells.map((s) => s.clubTitle);
    expect(titles.some((t) => /Türkiye/u.test(t))).toBe(false);
  });

  it("bağlantı hedefini alır, gösterilen adı değil", () => {
    expect(spells[7]?.clubTitle).toBe("Galatasaray (futbol takımı)");
  });

  /**
   * Bardakçı 2011-2022 Konyaspor'da, 2022'den beri Galatasaray'da. Konyaspor
   * dönemi 2021 sezonunda BİTER — 2022'de değil. İki dönem aynı yılda hem
   * bitip hem başlarsa üst üste binen dönem uyarısı üretilir (§8.2).
   */
  it("bitiş yılını sezon yılına indirger", () => {
    expect(spells[0]).toMatchObject({
      clubTitle: "Konyaspor",
      startYear: 2011,
      endYear: 2021,
      appearances: 104,
      goals: 8,
      isLoan: false,
    });
  });

  it("açık uçlu dönemin bitişini uydurmaz", () => {
    expect(spells[7]).toMatchObject({
      startYear: 2022,
      endYear: null,
      appearances: 119,
      goals: 10,
    });
  });

  it("kiralık dönemleri işaretler", () => {
    const loans = spells.filter((s) => s.isLoan);
    expect(loans).toHaveLength(6);
    expect(loans[0]?.clubTitle).toBe("1922 Konyaspor");
  });

  it("tek yıllık dönemi tek sezon sayar", () => {
    // `kulüpyıl5 = 2018` → Giresunspor, 2018/19 sezonu.
    expect(spells[4]).toMatchObject({
      clubTitle: "Giresunspor",
      startYear: 2018,
      endYear: 2018,
    });
  });

  it("alan numarasına göre sıralar", () => {
    expect(spells.map((s) => s.startYear)).toEqual([
      2011, 2014, 2014, 2017, 2018, 2018, 2019, 2022,
    ]);
  });
});

describe("parseInfoboxSpells — İngilizce şema", () => {
  const spells = parseInfoboxSpells(BERTRAND_INFOBOX);

  it("12 kulüp dönemini okur", () => {
    expect(spells).toHaveLength(12);
  });

  /**
   * `totalcaps = 407` numarasız bir alandır ve kariyer satırı değildir.
   * Numaralı alan zorunluluğu bunu doğal olarak dışarıda bırakır.
   */
  it("toplam satırını kariyer dönemi saymaz", () => {
    expect(spells.some((s) => s.appearances === 407)).toBe(false);
  });

  it("youthclubs alanlarını almaz", () => {
    expect(spells.map((s) => s.clubTitle)).not.toContain("Gillingham F.C.");
  });

  it("en tireli aralığı okur", () => {
    expect(spells[0]).toMatchObject({
      clubTitle: "Chelsea F.C.",
      startYear: 2006,
      endYear: 2014,
      appearances: 28,
      goals: 0,
      isLoan: false,
    });
  });

  it("(loan) notunu kiralık sayar", () => {
    expect(spells[1]).toMatchObject({
      clubTitle: "AFC Bournemouth",
      isLoan: true,
    });
    expect(spells.filter((s) => s.isLoan)).toHaveLength(9);
  });
});

describe("parseInfoboxSpells — aynı satıra sıkıştırılmış alanlar", () => {
  const spells = parseInfoboxSpells(FRESIA_INFOBOX);

  /**
   * Bu kutuda `| clubs1 = … | years1 = … | caps1 = … | goals1 = …` tek
   * satırda. Ölçüldü: İngilizce makalelerde 1657 `years` alanının 700'ü bu
   * biçimde; satır bazlı ayrıştırma o alanların hepsinde yanlış değer okur.
   */
  it("tek satırdaki alanların hepsini ayırır", () => {
    expect(spells[1]).toMatchObject({
      clubTitle: "Torino F.C.",
      startYear: 1908,
      endYear: 1908,
      appearances: 5,
      goals: 0,
    });
  });

  it("`?` değerini sıfır değil bilinmeyen sayar", () => {
    expect(spells[0]).toMatchObject({
      clubTitle: "Piemonte F.C.",
      appearances: null,
      goals: null,
    });
  });

  it("bağlantısız kulübü atlar", () => {
    // `| clubs6 = Andrea Doria` — bağlantı yok, QID'ye çözülemez (§4.3).
    expect(spells.map((s) => s.clubTitle)).not.toContain("Andrea Doria");
  });

  it("`Infobox soccer biography` şablonunu tanır", () => {
    expect(spells.length).toBeGreaterThan(5);
  });
});

describe("findInfobox", () => {
  it("kutu yoksa null döner", () => {
    expect(findInfobox("{{Infobox person\n| name = X\n}}")).toBeNull();
  });

  it("iç içe şablonda erken kapanmaz", () => {
    const body = findInfobox(BARDAKCI_INFOBOX);
    // `{{doğum tarihi ve yaşı|1994|9|7}}` ilk `}}`'yi taşıyor; orada durulsaydı
    // kutu 6. alanda kesilir ve tek bir kariyer satırı okunamazdı.
    expect(body).toContain("kulüp8");
  });

  it("kapanmamış şablonu yarım ayrıştırmaz", () => {
    expect(findInfobox("{{Futbolcu bilgi kutusu\n| kulüp1 = [[X]]")).toBeNull();
  });
});

describe("parseYearRange", () => {
  /**
   * Bitiş ucundan bir çıkarma kuralı ÖLÇÜLDÜ: 589 belirsizliksiz eşleşmede
   * çıkarılmış hâli %95,4, ham hâli %2,7 tam uyum verdi.
   */
  it.each([
    ["2011-2022", 2011, 2021],
    ["2006–2015", 2006, 2014],
    ["2022-", 2022, null],
    ["2015–", 2015, null],
    ["2014", 2014, 2014],
    // Sezon gösterimi: 2015/16 sezonu → tek sezon, 2015.
    ["2015–16", 2015, 2015],
    // Yüzyıl sınırı: 1999–00 → 2000, bir eksiği 1999.
    ["1999–00", 1999, 1999],
    ["{{0}}1990–1995", 1990, 1994],
    ["", null, null],
    ["?", null, null],
  ])("%s → %s…%s", (raw, startYear, endYear) => {
    expect(parseYearRange(raw)).toEqual({ startYear, endYear });
  });

  it("bitişi başlangıcın gerisine düşürmez", () => {
    // Bozuk kayıt: bitiş başlangıçla aynı yıl yazılmış. Çıkarma uygulanırsa
    // "başlangıç bitişten sonra" olur ve kayıt ayıklanırdı (§8.2).
    expect(parseYearRange("2018-2018")).toEqual({
      startYear: 2018,
      endYear: 2018,
    });
  });
});

describe("parseTally", () => {
  it.each([
    ["119", 119],
    ["0", 0],
    ["{{0}}42", 42],
    ["619 (250)", 619],
    ["?", null],
    ["-", null],
    ["", null],
    [undefined, null],
  ])("%s → %s", (raw, expected) => {
    expect(parseTally(raw)).toBe(expected);
  });
});

describe("parseClubLink", () => {
  it("boru işaretli bağlantıda hedefi alır", () => {
    expect(parseClubLink("[[Galatasaray (futbol takımı)|Galatasaray]]")).toBe(
      "Galatasaray (futbol takımı)",
    );
  });

  it("kiralık okunu ve notu bağlantıdan ayırır", () => {
    expect(parseClubLink("→ [[Adana Demirspor]] (kiralık)")).toBe(
      "Adana Demirspor",
    );
  });

  it("alt çizgileri boşluğa çevirir", () => {
    expect(parseClubLink("[[Real_Madrid_CF]]")).toBe("Real Madrid CF");
  });

  it("bölüm bağlantısını atar", () => {
    expect(parseClubLink("[[Chelsea F.C.#History|Chelsea]]")).toBe(
      "Chelsea F.C.",
    );
  });

  it("dosya ve kategori bağlantısını kulüp saymaz", () => {
    expect(parseClubLink("[[Dosya:logo.png|20px]]")).toBeNull();
    expect(parseClubLink("[[File:flag.svg]] [[Torino F.C.|Torino]]")).toBe(
      "Torino F.C.",
    );
  });

  it("bağlantı yoksa null döner", () => {
    expect(parseClubLink("Andrea Doria")).toBeNull();
  });
});

describe("looksLikeLoan", () => {
  /**
   * İki işaretin BİRLEŞİMİ, ölçüldü: 1005 satırda 4'ünde ok var not yok,
   * 1'inde not var ok yok. Tek işarete bakmak her iki yönde kayıt kaçırıyor.
   */
  it.each([
    ["→ [[Norwich City F.C.|Norwich City]] (loan)", true],
    ["→ [[Denizlispor]] (kiralık)", true],
    ["→ [[Lens]]", true],
    ["[[Getafe CF|Getafe]] (loan)", true],
    ["[[Southampton F.C.|Southampton]]", false],
  ])("%s → %s", (raw, expected) => {
    expect(looksLikeLoan(raw)).toBe(expected);
  });
});
