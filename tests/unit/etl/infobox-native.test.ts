import { describe, expect, it } from "vitest";

import { parseInfoboxSpells } from "../../../scripts/etl/sources/wikipedia/infobox";
import {
  DE_INFOBOX,
  FR_INFOBOX,
  FR_WRAPPED_INFOBOX,
  IT_INFOBOX,
} from "../../fixtures/wikipedia-native-infoboxes";

/**
 * Ana dil bilgi kutuları — PROJECT.md §4.3, Aşama 2.
 *
 * `tr`/`en` ailesi NUMARALI alanlar kullanıyor (`kulüp3`, `clubs3`); `it`/`de`/
 * `fr` ise KONUMSAL üçlü (`|yıl|kulüp|maç (gol)`). İkinci ailenin tehlikesi
 * yapısaldır: alan adı olmadığı için "hangi bloğu okuduğun" tek güvence, ve
 * yanlış blok altyapı kariyeridir (BR-2). Bu yüzden her dil için önce
 * KAÇ dönem okunduğu, sonra hangi bloğun okunmadığı doğrulanır.
 *
 * Fikstürler gerçek makalelerdir ve rastgele seçilmedi — her biri kendi dilinin
 * zor durumunu taşır (bkz. fixtures/wikipedia-native-infoboxes.ts).
 */

describe("parseInfoboxSpells — İtalyanca", () => {
  const spells = parseInfoboxSpells(IT_INFOBOX, "it");

  /**
   * BR-2'NİN ASIL SINAVI. Kutuda iki `{{Carriera sportivo}}` var:
   * `SquadreGiovanili` (altyapı, Lazio) ve `Squadre` (A takımı). İlk bloğu
   * almak — ki bu tam olarak deneme ayrıştırıcısının yaptığı şeydi — altyapı
   * dönemini kariyer sanmaktı.
   */
  it("altyapı bloğunu değil A takımı bloğunu okur", () => {
    expect(spells).toHaveLength(6);
    expect(spells.map((s) => s.startYear)).not.toContain(null);
  });

  it("kulüp adını düz metin olarak kabul eder", () => {
    // İtalyanca kutularda kulüpler bağlantı değil; bağlantı şartı koşmak bu
    // dili tamamen okunamaz kılardı.
    expect(spells[0]).toMatchObject({
      clubTitle: "Lazio",
      startYear: 1980,
      endYear: 1980,
      appearances: 12,
      goals: 0,
    });
  });

  it("maç ve golü tek alandan ayırır", () => {
    expect(spells[3]).toMatchObject({
      clubTitle: "Bologna",
      appearances: 191,
      goals: 46,
    });
  });

  /** Ölçüldü: `→` 24 kez, `prestito` 9 kez (§4.3). BR-3 — kiralık sayılır. */
  it("okla işaretli kiralığı tanır ve oku addan ayıklar", () => {
    expect(spells[1]).toMatchObject({
      clubTitle: "Forlì",
      isLoan: true,
      startYear: 1981,
      endYear: 1981,
    });
  });

  it("kiralık olmayan dönemi kiralık saymaz", () => {
    expect(spells.filter((s) => s.isLoan)).toHaveLength(1);
  });

  /** `sport = calcio` / `pos = G` adlandırılmış argümandır, satır değil. */
  it("adlandırılmış argümanları satır sanmaz", () => {
    const titles = spells.map((s) => s.clubTitle);
    expect(titles).toEqual([
      "Lazio",
      "Forlì",
      "Monza",
      "Bologna",
      "Udinese",
      "Empoli",
    ]);
  });
});

describe("parseInfoboxSpells — Almanca", () => {
  const spells = parseInfoboxSpells(DE_INFOBOX, "de");

  /**
   * Kutuda dört ayrı `{{Team-Station}}` yığını var: `jugendvereine_tabelle`
   * (1 satır), `vereine_tabelle` (5), `nationalmannschaft_tabelle` (boş) ve
   * `trainer_tabelle` (4). Kutunun TAMAMINDA `{{Team-Station}}` aramak 10
   * satır okur; doğrusu 5'tir.
   */
  it("yalnızca kariyer alanındaki satırları okur", () => {
    expect(spells).toHaveLength(5);
  });

  it("teknik direktörlük dönemlerini almaz", () => {
    const titles = spells.map((s) => s.clubTitle);
    expect(titles).not.toContain("SuS Klosterhardt");
    expect(titles).not.toContain("SC 1920 Oberhausen");
  });

  /**
   * BV Osterfeld hem altyapıda (1943–1952) hem A takımında (1952–1954) geçiyor.
   * Kulüp adına bakarak ayırmak imkânsız — ayrım YILDA görünür. Altyapı satırı
   * okunsaydı 1943 başlangıçlı bir dönem çıkardı.
   */
  it("aynı kulübün altyapı dönemini A takımı dönemiyle karıştırmaz", () => {
    expect(spells[0]).toMatchObject({
      clubTitle: "BV Osterfeld",
      startYear: 1952,
      endYear: 1953,
    });
    expect(spells.map((s) => s.startYear)).not.toContain(1943);
  });

  it("bağlantı hedefini alır ve maç/golü okur", () => {
    expect(spells[1]).toMatchObject({
      clubTitle: "1. FC Köln",
      startYear: 1954,
      endYear: 1956,
      appearances: 44,
      goals: 1,
    });
  });

  /**
   * Maç sayısı boş bırakılmış satırlar gerçek dönemlerdir. `0` yazmak
   * "hiç oynamadı" iddiası olurdu (§2.7) — null kalır.
   */
  it("boş maç alanını sıfır saymaz", () => {
    expect(spells[2]).toMatchObject({
      clubTitle: "Borussia Mönchengladbach",
      appearances: null,
      goals: null,
    });
  });

  it("bağlantısız kulübü de okur", () => {
    expect(spells[4]?.clubTitle).toBe("RSV Glückauf Klosterhardt");
  });
});

describe("parseInfoboxSpells — Fransızca", () => {
  const spells = parseInfoboxSpells(FR_INFOBOX, "fr");

  /**
   * Kutuda `parcours junior` ve `parcours amateur` BOŞ, `parcours pro` dolu,
   * ayrıca `sélection nationale` içinde ikinci bir `{{trois colonnes}}` var.
   * Millî takım kabı okunsaydı iki satır daha eklenirdi (BR-2).
   */
  it("millî takım kabını okumaz", () => {
    const titles = spells.map((s) => s.clubTitle);
    // Ad ile eşleştirme yapılmıyor: kulübün kendi adı da "France" içeriyor
    // (Racing Club de France). Ayrım alan adında, adın içinde değil.
    expect(titles).not.toContain(
      "Équipe de France militaire de football masculin",
    );
    expect(titles).not.toContain("Équipe de France espoirs de football");
  });

  /** 8 satırın 7'si kulüp; 8'inci `'''Total'''` satırı kulüp değildir. */
  it("toplam satırını dönem saymaz", () => {
    expect(spells).toHaveLength(7);
    expect(spells.map((s) => s.clubTitle)).not.toContain("Total");
  });

  /**
   * YILLAR BAĞLANTI OLARAK YAZILIYOR: `[[1984 en football|1984]]-[[1990 en
   * football|1990]]`. Bağlantı düzleştirilmezse `1984` ile tire arasına
   * `en football` girer, aralık tek yıl okunur ve dönemin sonu kaybolur.
   */
  it("bağlantı içindeki yıl aralığını çözer", () => {
    expect(spells[0]).toMatchObject({
      clubTitle: "Racing Club de France football Colombes 92",
      startYear: 1984,
      endYear: 1989,
    });
  });

  /** `{{0}}` hizalama şablonudur; `{{0}}72 {{0}}(9)` gerçekte 72 maç 9 goldür. */
  it("hizalama şablonlarını sayıya karıştırmaz", () => {
    expect(spells[0]).toMatchObject({ appearances: 72, goals: 9 });
    expect(spells[5]).toMatchObject({ appearances: 4, goals: 0 });
  });

  it("bilinmeyen maç sayısını sıfır saymaz", () => {
    // `{{0}}{{0}}- {{0}}(-)` — tire "bilinmiyor" demektir, "sıfır" değil.
    expect(spells[6]).toMatchObject({
      clubTitle: "Union sportive Boulogne Côte d'Opale",
      appearances: null,
      goals: null,
    });
  });

  /** Ölçüldü: Fransızca kiralığı `{{prêt}}` şablonuyla işaretliyor. */
  it("`{{prêt}}` ile işaretli kiralığı tanır", () => {
    expect(spells[1]).toMatchObject({
      clubTitle: "Racing Club de Lens",
      isLoan: true,
      startYear: 1988,
      endYear: 1988,
    });
    expect(spells.filter((s) => s.isLoan)).toHaveLength(1);
  });
});

/**
 * İKİNCİ FRANSIZCA BİÇİM — ikisi de KORPUSTA ÖLÇÜLEREK bulundu.
 *
 * Bu iki durum birim testleriyle değil, ayrıştırıcıyı 471 makalelik korpusa
 * koşturup "kaç makale okunamadı" diye sorarak ortaya çıktı: 29 Fransızca
 * makalenin 12'si sessizce boş dönüyordu (§8.2 — üretilen VERİ ölçülür).
 */
describe("parseInfoboxSpells — Fransızca ikinci biçim", () => {
  const spells = parseInfoboxSpells(FR_WRAPPED_INFOBOX, "fr");

  /** Alan `parcours senior`, kap `{{parcours pro}}` — ikisi aynı ad değil. */
  it("kap adı alan adından farklı olsa da okur", () => {
    expect(spells).toHaveLength(6);
  });

  /**
   * `{{nobr|{{FRA-d}} [[FC Sochaux]]}}` — şablonlar atılırken sargı
   * açılmazsa bağlantı da gider ve satır kulüpsüz kalır.
   */
  it("`{{nobr|…}}` sargısındaki kulüp bağlantısını kurtarır", () => {
    expect(spells[1]).toMatchObject({
      clubTitle: "Football Club Sochaux-Montbéliard",
      startYear: 1942,
      endYear: 1942,
    });
  });

  it("altyapı ve millî takım kaplarını okumaz", () => {
    // `{{parcours junior}}` ve `{{parcours national}}` kutuda DOLU duruyor;
    // ikisi de kap adı olarak tanınsaydı satır sayısı 6'yı aşardı (BR-2).
    expect(spells.map((s) => s.startYear)).toEqual([
      1937, 1942, 1943, 1944, 1948, 1948,
    ]);
  });

  it("tek yıllık dönemi aralık sanmaz", () => {
    expect(spells[4]).toMatchObject({
      clubTitle: "Union sportive du Mans",
      startYear: 1948,
      endYear: 1948,
    });
  });

  it("boş maç alanlarını sıfır saymaz, dolu olanı okur", () => {
    expect(spells.slice(0, 5).every((s) => s.appearances === null)).toBe(true);
    expect(spells[5]).toMatchObject({
      clubTitle: "Le Havre Athletic Club (football)",
      appearances: 11,
      goals: 3,
    });
  });
});

/**
 * DİL YANLIŞ VERİLİRSE SESSİZCE BOŞ DÖNER, uydurmaz.
 *
 * Bu davranış bilerek: ayrıştırıcı makalenin hangi vikiden geldiğini tahmin
 * etmez, çağıran söyler. Yanlış şemayla eşleşmeye çalışmak, sahte dönem
 * üretmenin en kolay yoludur.
 */
describe("parseInfoboxSpells — şema eşleşmezse", () => {
  it("İtalyanca kutuyu Türkçe şemayla okumaya çalışmaz", () => {
    expect(parseInfoboxSpells(IT_INFOBOX, "tr")).toEqual([]);
  });

  it("Almanca kutuyu Fransızca şemayla okumaya çalışmaz", () => {
    expect(parseInfoboxSpells(DE_INFOBOX, "fr")).toEqual([]);
  });

  it("boş metinde çökmez", () => {
    for (const site of ["it", "de", "fr"] as const) {
      expect(parseInfoboxSpells("", site)).toEqual([]);
    }
  });
});
