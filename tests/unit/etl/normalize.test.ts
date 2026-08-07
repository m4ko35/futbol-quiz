import { describe, expect, it } from "vitest";

import type { NormalizedPlayer } from "../../../scripts/etl/pipeline/normalize";
import {
  dedupeBy,
  isInScope,
  looksLikeYouthOrReserve,
  normalizeCountryCode,
  normalizePosition,
  parseWikidataDate,
  seasonYearAt,
  statementIdFromUri,
  tallies,
  toSearchKey,
  toSeasonYearOrNull,
  toShortName,
  toSpell,
} from "../../../scripts/etl/pipeline/normalize";
import type { SparqlBinding } from "../../../scripts/etl/sources/wikidata/schemas";

/** Test için kısa bağlama kurucusu. */
const bind = (fields: Record<string, string>): SparqlBinding =>
  Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, { type: "literal", value: v }]),
  );

describe("toSearchKey", () => {
  it("Türkçe aksanları sadeleştirir", () => {
    expect(toSearchKey("Beşiktaş")).toBe("besiktas");
    expect(toSearchKey("Göztepe SK")).toBe("goztepe sk");
    expect(toSearchKey("Çaykur Rizespor")).toBe("caykur rizespor");
  });

  it("noktalı ve noktasız i'yi aynı harfe indirger", () => {
    // "İ" varsayılan toLowerCase ile "i̇" (i + birleşik nokta) olur ve
    // aramayı bozar; "ı" ise NFD ile hiç ayrışmaz. İkisi de elle eşlenir.
    expect(toSearchKey("İstanbul Başakşehir FK")).toBe(
      "istanbul basaksehir fk",
    );
    expect(toSearchKey("Bandırmaspor")).toBe("bandirmaspor");
    expect(toSearchKey("İZMİR")).toBe("izmir");
  });

  it("noktalama ve fazla boşluğu tek boşluğa indirir", () => {
    expect(toSearchKey("  Galatasaray  S.K.  ")).toBe("galatasaray s k");
  });

  it("Latin olmayan aksanları da temizler", () => {
    expect(toSearchKey("Bayern München")).toBe("bayern munchen");
    expect(toSearchKey("Atlético Madrid")).toBe("atletico madrid");
  });
});

describe("toShortName", () => {
  it("kulüp eklerini atar", () => {
    expect(toShortName("Galatasaray Spor Kulübü")).toBe("Galatasaray");
    expect(toShortName("Kasımpaşa SK")).toBe("Kasımpaşa");
    expect(toShortName("Gençlerbirliği S.K.")).toBe("Gençlerbirliği");
  });

  it("ön ekleri atar", () => {
    expect(toShortName("FC Barcelona")).toBe("Barcelona");
    expect(toShortName("AS Roma")).toBe("Roma");
  });

  it("sadeleştirme anlamlı bir ad bırakmıyorsa özgün adı korur", () => {
    // "FC" atılırsa geriye 2 harf kalır — kullanıcı için anlamsız.
    expect(toShortName("FC St. Pauli")).not.toBe("");
    expect(toShortName("Ajax")).toBe("Ajax");
  });
});

describe("looksLikeYouthOrReserve — BR-2", () => {
  it("altyapı ve yedek takımları tanır", () => {
    expect(looksLikeYouthOrReserve("Galatasaray U19")).toBe(true);
    expect(looksLikeYouthOrReserve("Real Madrid Youth")).toBe(true);
    expect(looksLikeYouthOrReserve("Bayern Munich II")).toBe(true);
    expect(looksLikeYouthOrReserve("Chelsea Reserves")).toBe(true);
  });

  it("A takımlarını yanlışlıkla işaretlemez", () => {
    expect(looksLikeYouthOrReserve("Galatasaray")).toBe(false);
    expect(looksLikeYouthOrReserve("Bayer 04 Leverkusen")).toBe(false);
    expect(looksLikeYouthOrReserve("İstanbul Başakşehir FK")).toBe(false);
  });
});

describe("parseWikidataDate", () => {
  it("ISO tarihini çözer", () => {
    expect(parseWikidataDate("2011-08-15T00:00:00Z")?.getUTCFullYear()).toBe(
      2011,
    );
  });

  it("bilinmeyen ay/günü ('-00') ayın birine çevirir", () => {
    // Wikidata kesin olmayan tarihleri "1998-00-00T00:00:00Z" verebilir;
    // JavaScript bunu Invalid Date sayar ve kayıt boşuna kaybolurdu.
    const parsed = parseWikidataDate("1998-00-00T00:00:00Z");
    expect(parsed).not.toBeNull();
    expect(parsed?.getUTCFullYear()).toBe(1998);
  });

  it("tarih yoksa veya bozuksa null döner", () => {
    expect(parseWikidataDate(undefined)).toBeNull();
    expect(parseWikidataDate("bir tarih değil")).toBeNull();
  });
});

describe("toSeasonYearOrNull — BR-6", () => {
  it("tarihi sezon yılına indirger", () => {
    expect(toSeasonYearOrNull("2011-08-15T00:00:00Z")).toBe(2011);
    expect(toSeasonYearOrNull("2012-01-31T00:00:00Z")).toBe(2011);
  });

  it("tarih yoksa uydurmaz", () => {
    expect(toSeasonYearOrNull(undefined)).toBeNull();
  });
});

describe("statementIdFromUri", () => {
  it("ifade kimliğini ayıklar", () => {
    expect(
      statementIdFromUri(
        "http://www.wikidata.org/entity/statement/Q161089-AD66DA21-C0D1",
      ),
    ).toBe("Q161089-AD66DA21-C0D1");
  });

  it("değer yoksa null döner", () => {
    expect(statementIdFromUri(undefined)).toBeNull();
  });
});

describe("normalizePosition", () => {
  it("bilinen mevkileri Türkçeye eşler", () => {
    expect(normalizePosition("goalkeeper")).toBe("Kaleci");
    expect(normalizePosition("centre-back")).toBe("Defans");
    expect(normalizePosition("attacking midfielder")).toBe("Orta saha");
    expect(normalizePosition("striker")).toBe("Forvet");
  });

  it("Türkçe etiketleri de eşler", () => {
    // Türkçe Wikidata etiketi; 14.905 oyuncuda ham geçiyordu.
    expect(normalizePosition("savunma")).toBe("Defans");
    expect(normalizePosition("attacker")).toBe("Forvet");
    expect(normalizePosition("libero özel")).toBe("Defans");
  });

  /**
   * Tarihsel İngiliz mevkileri. 2-3-5 dizilişinde half-back'ler ORTA HATTI
   * kurardı; WM dizilişiyle birlikte merkezdeki oyuncu stopere çekildi. İki
   * "half" bu yüzden farklı yere gider ve kalıp sırası bunu belirler.
   */
  it("wing half orta saha, centre half defans olur", () => {
    expect(normalizePosition("wing half")).toBe("Orta saha");
    expect(normalizePosition("half-back")).toBe("Orta saha");
    expect(normalizePosition("centre half")).toBe("Defans");
    expect(normalizePosition("centerhalf")).toBe("Defans");
  });

  it("orta saha kalıbı forvet kalıbından ÖNCE eşleşir", () => {
    // İki kalıba da uyan etiketlerde sıra sonucu belirler.
    expect(normalizePosition("attacking midfielder")).toBe("Orta saha");
  });

  /**
   * Wikidata'nın `P413` alanı yalnızca futbol mevkisi taşımıyor; ham etikete
   * düşmek bir bakanlığı ya da bir kişi adını mevki diye gösteriyordu.
   */
  it("futbol mevkisi olmayan etiketleri null yapar", () => {
    expect(normalizePosition("İçişleri Bakanlığı (İngiltere)")).toBeNull();
    expect(normalizePosition("yardımcı koç")).toBeNull();
    expect(normalizePosition("Q114044295")).toBeNull();
    expect(normalizePosition("wicket-keeper")).toBeNull();
    expect(normalizePosition("fly-half")).toBeNull();
    expect(normalizePosition("bilinmeyen mevki")).toBeNull();
  });

  it("boş değeri null yapar", () => {
    expect(normalizePosition(undefined)).toBeNull();
    expect(normalizePosition("   ")).toBeNull();
  });
});

describe("normalizeCountryCode", () => {
  it("geçerli alpha-2 kodunu büyütür", () => {
    expect(normalizeCountryCode("tr")).toBe("TR");
  });

  it("geçersiz kodu reddeder", () => {
    expect(normalizeCountryCode("TUR")).toBeNull();
    expect(normalizeCountryCode(undefined)).toBeNull();
  });
});

/**
 * BR-6 — hassasiyete duyarlı sezon yılı.
 *
 * Wikidata tarihlerin %93,7'sini YIL hassasiyetinde tutuyor ve WDQS bunları
 * `YYYY-01-01` diye normalleştiriyor. Bu testler tam olarak o durumu kovalıyor:
 * gerçek bir Ocak tarihiyle "yalnızca yıl biliniyor" AYNI DEĞİLDİR.
 */
describe("seasonYearAt — BR-6 hassasiyet", () => {
  it("yıl hassasiyetinde başlangıcı O YILA yazar", () => {
    // "+2025-00-00" → WDQS "2025-01-01"; naif kural 2024 derdi (yanlış).
    expect(seasonYearAt("2025-01-01T00:00:00Z", 9, "start")).toBe(2025);
  });

  it("yıl hassasiyetinde bitişi ÖNCEKİ sezona yazar", () => {
    // "2025'te ayrıldı" = 2024/25 sezonunun sonu.
    expect(seasonYearAt("2025-01-01T00:00:00Z", 9, "end")).toBe(2024);
  });

  it("gün hassasiyetinde normal sezon kuralını uygular", () => {
    expect(seasonYearAt("2025-08-15T00:00:00Z", 11, "start")).toBe(2025);
    expect(seasonYearAt("2025-01-31T00:00:00Z", 11, "start")).toBe(2024);
    expect(seasonYearAt("2025-06-30T00:00:00Z", 11, "end")).toBe(2024);
  });

  it("ay hassasiyetinde normal sezon kuralını uygular", () => {
    expect(seasonYearAt("2025-08-01T00:00:00Z", 10, "start")).toBe(2025);
    expect(seasonYearAt("2026-01-01T00:00:00Z", 10, "start")).toBe(2025);
  });

  /** On yıl/yüzyıl bir sezona indirgenemez; uydurulmaz (§2.7). */
  it("yıldan kaba hassasiyette null döner", () => {
    expect(seasonYearAt("2020-01-01T00:00:00Z", 8, "start")).toBeNull();
    expect(seasonYearAt("1900-01-01T00:00:00Z", 7, "end")).toBeNull();
  });

  it("hassasiyet bildirilmemişse normal kurala düşer", () => {
    expect(seasonYearAt("2011-08-15T00:00:00Z", undefined, "start")).toBe(2011);
  });

  it("tarih yoksa null döner", () => {
    expect(seasonYearAt(undefined, 9, "start")).toBeNull();
  });
});

/** BR-22 — maç/gol akla yatkınlık denetimi. */
describe("tallies — BR-22", () => {
  it("normal değerleri olduğu gibi geçirir", () => {
    expect(tallies(64, 3)).toEqual({
      appearances: 64,
      goals: 3,
      disputedGoals: null,
      disputedAppearances: null,
    });
  });

  /** Ölçülen hata: Maldini @ Milan 1987 — maç değil, katılış yılı. */
  it("yıl kılıklı maç sayısını düşürür", () => {
    expect(tallies(1987, undefined).appearances).toBeNull();
    expect(tallies(5000, undefined).appearances).toBeNull();
  });

  /** Gerçek rekorlar kesilmemeli: Trollope 770, Messi 474 gol. */
  it("gerçek rekorları korur", () => {
    expect(tallies(770, undefined).appearances).toBe(770);
    expect(tallies(778, 474).goals).toBe(474);
  });

  /**
   * Gol maçı aşıyorsa karar ERTELENİR — BR-22'nin yeni hâli.
   *
   * Eskiden değer burada silinirdi ve öncülü yanlıştı: elit golcüler maç
   * sayısından fazla gol atar (Ronaldo 292/311). Artık gol boşaltılır ama
   * özgün çift saklanır; kararı ikinci kaynak verir (§9.2,
   * `resolveDisputedTallies`).
   */
  it("gol maçtan fazlaysa kararı ERTELER, özgün çifti saklar", () => {
    expect(tallies(30, 780)).toEqual({
      appearances: 30,
      goals: null,
      disputedGoals: 780,
      disputedAppearances: 30,
    });
  });

  it("maç bilinmiyorsa golü yalnızca sınıra göre değerlendirir", () => {
    expect(tallies(undefined, 474)).toEqual({
      appearances: null,
      goals: 474,
      disputedGoals: null,
      disputedAppearances: null,
    });
    expect(tallies(undefined, 5603)).toEqual({
      appearances: null,
      goals: null,
      disputedGoals: null,
      disputedAppearances: null,
    });
  });

  /** Sıfırlamak DEĞİL null yapmak: "0 maç" bir iddiadır (§2.7). */
  it("eksik değeri null yapar, sıfır YAPMAZ", () => {
    expect(tallies(undefined, undefined)).toEqual({
      appearances: null,
      goals: null,
      disputedGoals: null,
      disputedAppearances: null,
    });
  });

  it("negatif değeri reddeder", () => {
    expect(tallies(-5, -1)).toEqual({
      appearances: null,
      goals: null,
      disputedGoals: null,
      disputedAppearances: null,
    });
  });
});

describe("toSpell", () => {
  const statementUri =
    "http://www.wikidata.org/entity/statement/Q161089-AD66DA21";
  const playerUri = "http://www.wikidata.org/entity/Q161089";

  /**
   * ÖLÇÜLMÜŞ GERİLEME KORUMASI. Yıl hassasiyetli "2024 → 2024" kaydında iki
   * kural ters düşer (başlangıç 2024, bitiş 2023) ve `sanitizeSpells` kaydı
   * atardı. Veride böyle 19.478 dönem var; ayıklama oranı %1 eşiğini aşar ve
   * ETL hiç tamamlanamazdı.
   */
  it("tek takvim yılına sığan dönemde bitişi başlangıca hizalar", () => {
    const spell = toSpell(
      bind({
        st: statementUri,
        player: playerUri,
        start: "2024-01-01T00:00:00Z",
        startPrecision: "9",
        end: "2024-01-01T00:00:00Z",
        endPrecision: "9",
      }),
      "Q495299",
      false,
    );

    expect(spell).toMatchObject({ startYear: 2024, endYear: 2024 });
  });

  it("yıl hassasiyetli çok sezonluk dönemi doğru çevirir", () => {
    const spell = toSpell(
      bind({
        st: statementUri,
        player: playerUri,
        start: "2020-01-01T00:00:00Z",
        startPrecision: "9",
        end: "2025-01-01T00:00:00Z",
        endPrecision: "9",
      }),
      "Q495299",
      false,
    );

    // Wikidata "2020–2025" = 2020/21'den 2024/25'e, yani beş sezon.
    expect(spell).toMatchObject({ startYear: 2020, endYear: 2024 });
  });

  it("tam bir dönem kaydını çevirir", () => {
    const spell = toSpell(
      bind({
        st: statementUri,
        player: playerUri,
        start: "2011-08-15T00:00:00Z",
        end: "2014-06-30T00:00:00Z",
        apps: "64",
        goals: "3",
      }),
      "Q495299",
      false,
    );

    expect(spell).toMatchObject({
      wikidataStatementId: "Q161089-AD66DA21",
      playerWikidataId: "Q161089",
      clubWikidataId: "Q495299",
      startYear: 2011,
      endYear: 2013, // 30 Haziran 2014 → 2013/14 sezonu
      isCurrent: false,
      isLoan: false,
      appearances: 64,
      goals: 3,
    });
  });

  it("kiralık dönemi P1642=Q2914547 ile tanır", () => {
    const loan = toSpell(
      bind({
        st: statementUri,
        player: playerUri,
        acq: "http://www.wikidata.org/entity/Q2914547",
      }),
      "Q495299",
      false,
    );
    expect(loan?.isLoan).toBe(true);

    const transfer = toSpell(
      bind({
        st: statementUri,
        player: playerUri,
        acq: "http://www.wikidata.org/entity/Q1811518",
      }),
      "Q495299",
      false,
    );
    expect(transfer?.isLoan).toBe(false);
  });

  it("bitiş tarihi yoksa oyuncuyu hâlâ kulüpte sayar", () => {
    const spell = toSpell(
      bind({
        st: statementUri,
        player: playerUri,
        start: "2025-09-02T00:00:00Z",
      }),
      "Q495299",
      false,
    );

    expect(spell?.isCurrent).toBe(true);
    expect(spell?.endYear).toBeNull(); // uydurulmaz
  });

  it("ifade kimliği veya oyuncu yoksa kaydı reddeder", () => {
    expect(toSpell(bind({ player: playerUri }), "Q495299", false)).toBeNull();
    expect(toSpell(bind({ st: statementUri }), "Q495299", false)).toBeNull();
  });

  it("altyapı bayrağını kulüpten devralır", () => {
    const spell = toSpell(
      bind({ st: statementUri, player: playerUri }),
      "Q495299",
      true,
    );
    expect(spell?.isYouth).toBe(true);
  });
});

describe("isInScope — erkek ligi kapsamı", () => {
  const player = (genderQid: string | null): NormalizedPlayer => ({
    wikidataId: "Q1",
    name: "Oyuncu",
    searchKey: "oyuncu",
    birthDate: null,
    nationality: null,
    position: null,
    genderQid,
    nationalCaps: null,
    heightCm: null,
    weightKg: null,
  });

  it("erkek olarak kayıtlı oyuncuyu kapsar", () => {
    expect(isInScope(player("Q6581097"))).toBe(true);
  });

  it("kadın olarak kayıtlı oyuncuyu kapsam dışı bırakır", () => {
    // Wikidata kadın takımı dönemlerini aynı kulüp varlığına bağlıyor;
    // ayrım ancak oyuncu düzeyinde yapılabiliyor.
    expect(isInScope(player("Q6581072"))).toBe(false);
  });

  it("P21 kaydı olmayan oyuncuyu kapsam dışı bırakmaz", () => {
    // Eksik meta veri dışlama gerekçesi değildir: ölçümde 3638 oyuncunun
    // yalnızca 5'inde P21 yoktu ve bunlar gerçek oyuncular.
    expect(isInScope(player(null))).toBe(true);
  });
});

describe("dedupeBy", () => {
  it("aynı anahtarlı ilk kaydı korur", () => {
    const input = [
      { id: "a", v: 1 },
      { id: "b", v: 2 },
      { id: "a", v: 3 },
    ];
    expect(dedupeBy(input, (x) => x.id)).toEqual([
      { id: "a", v: 1 },
      { id: "b", v: 2 },
    ]);
  });
});
