import { describe, expect, it } from "vitest";
import {
  MAX_CAREER_TALLY,
  mergeCareerTotals,
  parseCareerTotal,
  parseCareerTotalTr,
} from "../../../scripts/etl/sources/wikipedia/career-total";

/**
 * §9.2 — Vikipedi kariyer toplamı tablosu.
 *
 * BURADAKİ HER TEST ÖLÇÜLMÜŞ BİR MAKALEDEN GELİR. Ayrıştırıcının ilk hâli
 * 70 kişilik örneklemde %94,3 okudu ama okuduklarının 5'i YANLIŞTI; bu
 * dosyadaki senaryolar o beşinin ve doğrulama örneklerinin şeklidir.
 * Yanlış sayı, okunamamış sayıdan kötüdür (§2.7).
 */

/** Gerçek tabloların iskeleti — başlıklar ölçülen biçimlerden. */
function article(body: string): string {
  return [
    "'''Oyuncu''' bir futbolcudur.",
    "",
    "==Career statistics==",
    "===Club===",
    '{| class="wikitable" style="text-align:center"',
    '!rowspan="2"|Club',
    '!rowspan="2"|Season',
    '!colspan="3"|League',
    '!colspan="2"|National cup',
    '!colspan="2"|Europe',
    '!colspan="2"|Total',
    "|-",
    body,
    "|}",
    "",
    "==References==",
  ].join("\n");
}

describe("parseCareerTotal — kariyer toplamı satırı", () => {
  it("RONALDO: binlik ayraçlı toplamı doğru okur", () => {
    // `1,099` ayracı yok sayılsaydı **1** olurdu — sessiz ve inandırıcı.
    const total = parseCareerTotal(
      article(
        [
          '!colspan="3"|Career total',
          "!760!!600!!78!!44!!12!!4!!216!!158!!33!!24!!1,099!!830",
        ].join("\n"),
      ),
    );

    expect(total).toEqual({ appearances: 1099, goals: 830 });
  });

  it("KANE: `||` ayracını da okur", () => {
    // Ayraç makaleden makaleye değişiyor; `!!` arayan ilk hâl bunu kaçırdı.
    const total = parseCareerTotal(
      article(
        [
          '!colspan="3"|Career total',
          "!468||325||35||28||22||7||114||78||9||4||647||442",
        ].join("\n"),
      ),
    );

    expect(total).toEqual({ appearances: 647, goals: 442 });
  });

  it("etiketle AYNI satırdaki değerleri okur", () => {
    const total = parseCareerTotal(article('!colspan="2"|Total||121||85'));

    expect(total).toEqual({ appearances: 121, goals: 85 });
  });

  it("kayıtsız kulvarın `—` hücresi sayı üretmez ama satırı çürütmez", () => {
    const total = parseCareerTotal(
      article(
        [
          '!colspan="3"|Career total',
          '!317||213||21||15||colspan="2"|—||435||280',
        ].join("\n"),
      ),
    );

    expect(total).toEqual({ appearances: 435, goals: 280 });
  });

  /**
   * GUARDIOLA VAKASI — ölçülen en tehlikeli kusur.
   *
   * Değerler "en az" anlamında `+` taşıyor. Okunabilenleri toplayıp
   * okunamayanları atlamak `[398, 21, 4, 0]` veriyordu ve son iki sayı
   * kuralı bundan **4 maç / 0 gol** üretiyordu — çift sayı olduğu için
   * bütünlük denetimi bile susuyordu.
   */
  it("GUARDIOLA VAKASI: `+` ve `?` taşıyan satır TAMAMEN reddedilir", () => {
    const total = parseCareerTotal(
      article(
        [
          '!colspan="3"|Career total',
          "! 398 || 21 || 33+ || 3+ || 72+ || 4 || 21+ || 0 || 524+ || 28+",
        ].join("\n"),
      ),
    );

    expect(total).toBeNull();
  });

  it("`?` hücresi de satırı çürütür", () => {
    const total = parseCareerTotal(
      article(
        ['!colspan="2"|Total', "! 36 || 5 || ? || 1 || 36 || 7"].join("\n"),
      ),
    );

    expect(total).toBeNull();
  });

  /**
   * CASCARINO / KRØLDRUP VAKASI — `Career statistics` bölümü doğrudan
   * `===International===` ile başlıyor ve kulüp tablosu HİÇ YOK. "İlk
   * tabloyu al" kuralı orada millî takım tablosunu okuyordu.
   */
  it("kulüp alt bölümü YOKSA millî takım tablosunu okumaz", () => {
    const wikitext = [
      "==Career statistics==",
      "===International===",
      '{| class="wikitable" style="text-align:center"',
      "!National team!!Year!!Apps!!Goals",
      "|-",
      '!colspan="2"|Total || 88 || 19',
      "|}",
    ].join("\n");

    expect(parseCareerTotal(wikitext)).toBeNull();
  });

  /**
   * RONALDO VAKASI'nın ikinci yarısı: kulüp tablosu VAR ama millî takım
   * tablosu ondan SONRA geliyor ve o da toplam satırı taşıyor. Sınır
   * konmasaydı 1.099/830 yerine 192/131 okunurdu.
   */
  it("kulüp tablosundan sonraki millî takım tablosuna TAŞMAZ", () => {
    const wikitext = [
      "==Career statistics==",
      "===Club===",
      '{| class="wikitable"',
      "!Club!!Season",
      "|-",
      '!colspan="3"|Career total',
      "!760!!600!!1,099!!830",
      "|}",
      "===International===",
      '{| class="wikitable"',
      "!Team!!Year",
      "|-",
      '!colspan="2"|Career total',
      "!192!!131",
      "|}",
    ].join("\n");

    expect(parseCareerTotal(wikitext)).toEqual({
      appearances: 1099,
      goals: 830,
    });
  });

  it("teknik direktörlük tablosunu okumaz", () => {
    // Ayrı bir ÜST başlık; `{{WDLtot}}` galibiyet/beraberlik/mağlubiyet
    // taşır. Henry ve Sergen Yalçın'da naif kural bunu yakalıyordu.
    const wikitext = [
      "==Career statistics==",
      "===Club===",
      '{| class="wikitable"',
      "!Club!!Season",
      "|-",
      '!colspan="3"|Career total',
      "!600!!290!!813!!366",
      "|}",
      "==Managerial statistics==",
      '{| class="wikitable"',
      "!Team!!From",
      "|-",
      '!colspan="3"|Total',
      "{{WDLtot|276|121|67|88}}",
      "|}",
    ].join("\n");

    expect(parseCareerTotal(wikitext)).toEqual({
      appearances: 813,
      goals: 366,
    });
  });

  it("kulüp ARA toplamları değil, SON toplam satırı alınır", () => {
    const total = parseCareerTotal(
      article(
        [
          '!colspan="2"|Total',
          "!53||5||0||0||6||0||59||5",
          "|-",
          '!colspan="2"|Total',
          "!263||6||33||2||71||3||382||11",
          "|-",
          '!colspan="3"|Career total',
          "!398||21||33||3||72||4||524||28",
        ].join("\n"),
      ),
    );

    expect(total).toEqual({ appearances: 524, goals: 28 });
  });

  /**
   * M'VILA VAKASI — kariyer toplamı satırı YOK, yalnızca kulüp başına ara
   * toplamlar var. "Sonuncuyu al" son kulübün sayısını (91 maç) bütün
   * kariyer diye yazıyordu; gerçek kariyeri 449 lig maçı.
   */
  it("M'VILA VAKASI: kariyer satırı yoksa ve BİRDEN ÇOK ara toplam varsa susar", () => {
    const total = parseCareerTotal(
      article(
        [
          '!colspan="2"|Total',
          "!126!!2!!12!!1!!7!!1!!150!!4",
          "|-",
          '!colspan="2"|Total',
          "!64!!3!!3!!0!!13!!0!!80!!3",
          "|-",
          '!colspan="2"|Total',
          "!78!!1!!6!!0!!5!!0!!91!!1",
        ].join("\n"),
      ),
    );

    expect(total).toBeNull();
  });

  it("kariyer satırı VARSA ara toplamlar atlanır", () => {
    const total = parseCareerTotal(
      article(
        [
          '!colspan="2"|Total',
          "!126!!2!!150!!4",
          "|-",
          '!colspan="3"|Career total',
          "!268!!6!!321!!8",
        ].join("\n"),
      ),
    );

    expect(total).toEqual({ appearances: 321, goals: 8 });
  });

  /**
   * VARGAS VAKASI — tablo her kulvar için ÜÇ sütun tutuyor
   * (`Apps / Goals / Assists`). "Son iki sayı" kuralı orada maç/gol değil
   * **gol/asist** verir ve sonuç akla yatkın göründüğü için fark edilmez.
   */
  it("VARGAS VAKASI: asist sütunlu tablo hiç okunmaz", () => {
    const wikitext = [
      "==Career statistics==",
      "===Club===",
      '{| class="wikitable"',
      '!colspan="3"|Club performance',
      '!colspan="3"|League',
      '!colspan="3"|Total',
      "|-",
      "!Club!!League!!Season",
      "!Apps!!Goals!!Assists",
      "!Apps!!Goals!!Assists",
      "|-",
      '!colspan="1"|Total',
      "!69!!5!!7!!73!!6!!8",
      "|}",
    ].join("\n");

    expect(parseCareerTotal(wikitext)).toBeNull();
  });

  it("TEK kulüplü oyuncuda kulüp toplamı kariyer toplamıdır", () => {
    const total = parseCareerTotal(
      article(
        ['!colspan="2"|Total', "!156!!15!!15!!2!!28!!2!!203!!19"].join("\n"),
      ),
    );

    expect(total).toEqual({ appearances: 203, goals: 19 });
  });

  it("SİVOK VAKASI: `colspan` DEĞERİNE bakılmaz", () => {
    // "Career total" hem `colspan=2` hem `colspan=3` ile yazılıyor. Değere
    // bağlanmak Sivok'ta kulüp ara toplamını kariyer toplamı sandırmıştı.
    const total = parseCareerTotal(
      article(['!colspan="2"|Career total', "!156!!15!!203!!19"].join("\n")),
    );

    expect(total).toEqual({ appearances: 203, goals: 19 });
  });

  it("TEK sayı kalan satır reddedilir — sütunlar çift gelir", () => {
    const total = parseCareerTotal(
      article(['!colspan="3"|Career total', "!760!!600!!1099"].join("\n")),
    );

    expect(total).toBeNull();
  });

  it("gol maçtan ÇOK olamaz", () => {
    const total = parseCareerTotal(
      article(['!colspan="3"|Career total', "!100!!200!!100!!200"].join("\n")),
    );

    expect(total).toBeNull();
  });

  it("akla yatkın tavanı aşan sayı reddedilir", () => {
    const asiri = MAX_CAREER_TALLY + 1;
    const total = parseCareerTotal(
      article(['!colspan="3"|Career total', `!10!!5!!${asiri}!!30`].join("\n")),
    );

    expect(total).toBeNull();
  });

  /**
   * RONALDO'nun gerçek toplamı 1.099 maç; `MAX_SPELL_TALLY` (1000) burada
   * kullanılamaz, çünkü o DÖNEM başınadır. Tavanın gerçek kayıtları
   * kesmediği bu testle tutuluyor.
   */
  it("tavan, bilinen en yüksek gerçek kariyeri KESMEZ", () => {
    const total = parseCareerTotal(
      article(
        ['!colspan="3"|Career total', "!760!!600!!1,099!!830"].join("\n"),
      ),
    );

    expect(total?.appearances).toBe(1099);
  });

  it("bölüm yoksa null döner", () => {
    expect(parseCareerTotal("'''Oyuncu''' bir futbolcudur.")).toBeNull();
  });

  it("toplam satırı olmayan tablo null döner", () => {
    const total = parseCareerTotal(article("|Barcelona||2019||30||10"));

    expect(total).toBeNull();
  });

  it("kapanmamış tablo null döner", () => {
    const wikitext = [
      "==Career statistics==",
      "===Club===",
      '{| class="wikitable"',
      '!colspan="3"|Career total',
      "!760!!600!!1099!!830",
    ].join("\n");

    expect(parseCareerTotal(wikitext)).toBeNull();
  });

  it("dipnot ve kaynak etiketleri sayı sanılmaz", () => {
    const total = parseCareerTotal(
      article(
        [
          '!colspan="3"|Career total',
          '!760<ref name="x">{{cite web|url=http://a/1234}}</ref>!!600!!1099{{efn|name=UCL}}!!830',
        ].join("\n"),
      ),
    );

    expect(total).toEqual({ appearances: 1099, goals: 830 });
  });
});

/**
 * §9.2 BR-65 — Türkçe kariyer istatistiği tablosu.
 *
 * BURADAKİ SENARYOLAR GERÇEK tr.wiki MAKALELERİNDEN ölçüldü (Eren Elmalı,
 * Uğurcan Çakır, Kenan Yıldız, Hakan Çalhanoğlu, Merih Demiral). Türkçe biçim
 * İngilizceden AYRI: çoğu tablo Maç/Gol/Asist ÜÇLÜSÜ kullanır (İngilizce çift),
 * o yüzden en sağdaki "Toplam" grubu satırın son k sütunudur (asist varsa 3).
 * Yanlış sayı okunamamış sayıdan kötüdür (§2.7).
 */
function trClubArticle(heading: string, tableRows: string): string {
  return [
    "'''Oyuncu''' bir futbolcudur.",
    "",
    heading,
    '{| class="wikitable" style="text-align: center;"',
    tableRows,
    "|}",
    "",
    "=== Millî takım istatistikleri ===",
    '{| class="wikitable"',
    "! No !! Tarih !! Millî takım !! Maç !! Gol",
    "|-",
    "! colspan=2 | Kariyer toplamı || 30 || 4",
    "|}",
  ].join("\n");
}

describe("parseCareerTotalTr — Türkçe kariyer toplamı", () => {
  it("EREN ELMALI: üçlü sütun (asist), 'Kariyer toplamı' satırı → 236/6", () => {
    // Son grup !!236!!6!!10 (Maç/Gol/Asist); asist ATILIR, gol 10 değil 6.
    const total = parseCareerTotalTr(
      trClubArticle(
        "=== Kulüp takımı istatistikleri ===",
        [
          '!Sezon!!Kulüp!!Lig!!{{Kısaltma|M|Maç}}!!{{Kısaltma|G|Gol}}!!{{Kısaltma|A|Asist}}!!colspan="3"|Toplam',
          "|-",
          "|2019-20||Silivrispor||3. Lig",
          "||25||0||0 ||27||0||0",
          "|-",
          "!colspan=3| Toplam",
          "!25!!0!!0 !!27!!0!!0",
          "|-",
          "! colspan=3 | Kariyer toplamı",
          "!198!!4!!8 !!24!!1!!2 !!3!!1!!0 !!24!!0!!0 !!236!!6!!10",
        ].join("\n"),
      ),
    );

    expect(total).toEqual({ appearances: 236, goals: 6 });
  });

  it("UGURCAN CAKIR: çift sütun (asist yok), satır başına bir hücre → 339/0", () => {
    const total = parseCareerTotalTr(
      trClubArticle(
        "=== Kulüp ===",
        [
          "!Kulüp!!Sezon!!Lig!!Maç!!Gol!!Maç!!Gol!!Maç!!Gol!!Maç!!Gol!!Maç!!Gol",
          "|-",
          "|Trabzonspor||2014-15||Süper Lig",
          "|0|0|0|0|0|0|0|0|0|0",
          "|-",
          '! colspan="3" |Kariyer toplamı',
          "!268",
          "!0",
          "!29",
          "!0",
          "!39",
          "!0",
          "!3",
          "!0",
          "!339",
          "!0",
        ].join("\n"),
      ),
    );

    expect(total).toEqual({ appearances: 339, goals: 0 });
  });

  it("KENAN YILDIZ: ARADAKİ boş asist hücresi sütunu kaydırmaz → 103/22", () => {
    // Süper Kupa grubunun asisti boş (!1!!1!!) ama Toplam grubu (!103!!22!!12)
    // yine son üç sütun; boş hücre `null` sütun olarak korunur.
    const total = parseCareerTotalTr(
      trClubArticle(
        "=== Kulüp takım istatistikleri===",
        [
          "!Sezon!!Kulüp!!Lig!!{{Kısaltma|M|Maç}}!!{{Kısaltma|G|Gol}}!!{{Kısaltma|A|Asist}}",
          "|-",
          "|2023-24||Juventus||Serie A",
          "||27||2|| ||32||4||",
          "|-",
          '!colspan="3"|Kariyer toplam',
          "! 75||14||7",
          "!  8|| 2||1",
          "!  1|| 1||",
          "! 15|| 2||3",
          "!  4|| 3||1",
          "! 103||22||12",
        ].join("\n"),
      ),
    );

    expect(total).toEqual({ appearances: 103, goals: 22 });
  });

  it("MERIH DEMIRAL: tek satır, boş colspan grupları → 200/8", () => {
    const total = parseCareerTotalTr(
      trClubArticle(
        "=== Kulüp takım istatistikleri ===",
        [
          "!Sezon!!Kulüp!!Lig!!{{Kısaltma|M|Maç}}!!{{Kısaltma|G|Gol}}!!{{Kısaltma|A|Asist}}",
          "|-",
          "|2016-17||Alanyaspor||Süper Lig",
          "||1||0||0 ||1||0||0",
          "|-",
          '!colspan="3"|Kariyer toplamı',
          "!168||7||5 ||13|| || ||1|| || ||18||1||1 ||200||8||6",
        ].join("\n"),
      ),
    );

    expect(total).toEqual({ appearances: 200, goals: 8 });
  });

  it("TEK KULÜP: 'Kariyer toplamı' yoksa ve tek 'Toplam' varsa onu okur", () => {
    const total = parseCareerTotalTr(
      trClubArticle(
        "=== Kulüp ===",
        [
          "!Kulüp!!Sezon!!Lig!!Maç!!Gol!!Maç!!Gol!!Maç!!Gol",
          "|-",
          "|Tek Kulüp||2020-21||Süper Lig",
          "|30|5|3|1|33|6",
          "|-",
          "!colspan=3|Toplam",
          "!30!!5!!3!!1!!120!!40",
        ].join("\n"),
      ),
    );

    expect(total).toEqual({ appearances: 120, goals: 40 });
  });

  it("ÇOK KULÜP: kariyer toplamı yoksa BİRDEN ÇOK ara toplamda SUSAR", () => {
    const total = parseCareerTotalTr(
      trClubArticle(
        "=== Kulüp ===",
        [
          "!Kulüp!!Sezon!!Lig!!Maç!!Gol!!Maç!!Gol",
          "|-",
          "|Kulüp A||2018-19||Lig",
          "|40|10|44|11",
          "|-",
          "!colspan=3|Toplam",
          "!40!!10!!44!!11",
          "|-",
          "|Kulüp B||2020-21||Lig",
          "|50|20|55|22",
          "|-",
          "!colspan=3|Toplam",
          "!50!!20!!55!!22",
        ].join("\n"),
      ),
    );

    expect(total).toBeNull();
  });

  it("gol maçtan çok çıkarsa satır reddedilir (§2.7)", () => {
    const total = parseCareerTotalTr(
      trClubArticle(
        "=== Kulüp ===",
        [
          "!Kulüp!!Sezon!!Lig!!Maç!!Gol",
          "|-",
          '! colspan="3" |Kariyer toplamı',
          "!10!!99",
        ].join("\n"),
      ),
    );

    expect(total).toBeNull();
  });

  it("kulüp tablosu YOKSA null döner (yalnız millî tablo)", () => {
    const noClub = [
      "'''Oyuncu''' bir futbolcudur.",
      "",
      "=== Millî takım istatistikleri ===",
      '{| class="wikitable"',
      "! No !! Millî takım !! Maç !! Gol",
      "|-",
      '! colspan="2" |Kariyer toplamı || 30 || 4',
      "|}",
    ].join("\n");

    expect(parseCareerTotalTr(noClub)).toBeNull();
  });

  it("düz metin 'Kulüp kariyeri' bölümü (tablo yok) atlanır", () => {
    // İlk "Kulüp" başlığı anlatı; toplam satırı olan tablo İKİNCİ başlıkta.
    const text = [
      "== Kulüp kariyeri ==",
      "Oyuncu uzun bir anlatı. Hiç tablo yok, yalnız düz metin.",
      "",
      "=== Kulüp takım istatistikleri ===",
      '{| class="wikitable"',
      "!Sezon!!Kulüp!!Lig!!Maç!!Gol!!Maç!!Gol",
      "|-",
      '! colspan="3" |Kariyer toplamı',
      "!300!!90!!330!!95",
      "|}",
    ].join("\n");

    expect(parseCareerTotalTr(text)).toEqual({
      appearances: 330,
      goals: 95,
    });
  });
});

describe("mergeCareerTotals — İngilizce öncelikli, Türkçe yedek", () => {
  it("İngilizce VARSA kalır; Türkçe yalnız boşluğu doldurur", () => {
    const en = new Map([["Q1", { appearances: 500, goals: 100 }]]);
    const tr = new Map([
      ["Q1", { appearances: 999, goals: 999 }],
      ["Q2", { appearances: 236, goals: 6 }],
    ]);

    const merged = mergeCareerTotals(en, tr);

    expect(merged.get("Q1")).toEqual({ appearances: 500, goals: 100 });
    expect(merged.get("Q2")).toEqual({ appearances: 236, goals: 6 });
    expect(merged.size).toBe(2);
  });
});
