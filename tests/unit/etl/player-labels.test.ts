import { describe, expect, it } from "vitest";
import {
  labelsFrom,
  playerIdsOf,
  playersFrom,
  unlabeledPlayerBindings,
} from "../../../scripts/etl/pipeline/normalize";
import {
  clubsByLeagueLink,
  playerDetails,
  playerLabels,
} from "../../../scripts/etl/sources/wikidata/queries";
import type { SparqlBinding } from "../../../scripts/etl/sources/wikidata/schemas";

/**
 * §5.3.2 — adsız kalan oyuncu veri kümesinden tamamen düşüyor.
 *
 * BU TESTLERİN TUTTUĞU ŞEY ölçülmüş bir kusurdur, varsayılan bir tehlike
 * değil: Wikidata kişi adlarını `mul` diline taşırken `en` ve `tr`
 * etiketlerini sildi, `"tr,en"` diyen sorgu etiket olarak QID aldı,
 * `toPlayer` oyuncuyu adsız sayıp düşürdü ve 21 Ağustos 2026 veri kümesinden
 * Cristiano Ronaldo ile Lionel Messi dâhil 13 oyuncu kayboldu.
 *
 * Sebep `LABEL_LANGUAGES`'a `mul` eklenerek kapatıldı; buradaki testler
 * geriye kalan yolu tutuyor — adsız kalan bir oyuncunun İKİNCİ BİR YOLA
 * sorulması ve sorulamıyorsa SAYILMASI. Aşağıdaki bağlamalar gerçek yanıtın
 * şeklidir: QID etiketi DİL ETİKETSİZ gelir, çözülmüş etiketlerde `xml:lang`
 * bulunur.
 */

const uri = (qid: string): string => `http://www.wikidata.org/entity/${qid}`;

function playerRow(fields: {
  player: string;
  label?: string;
  lang?: string;
  countryCode?: string;
  positionLabel?: string;
}): SparqlBinding {
  const binding: Record<
    string,
    { type: string; value: string; "xml:lang"?: string }
  > = {
    player: { type: "uri", value: uri(fields.player) },
    playerLabel: {
      type: "literal",
      value: fields.label ?? "Oyuncu",
      ...(fields.lang === undefined ? {} : { "xml:lang": fields.lang }),
    },
  };
  if (fields.countryCode !== undefined) {
    binding["countryCode"] = { type: "literal", value: fields.countryCode };
  }
  if (fields.positionLabel !== undefined) {
    binding["positionLabel"] = { type: "literal", value: fields.positionLabel };
  }
  return binding as unknown as SparqlBinding;
}

function labelRow(qid: string, label: string, lang: string): SparqlBinding {
  return {
    player: { type: "uri", value: uri(qid) },
    label: { type: "literal", value: label, "xml:lang": lang },
  } as unknown as SparqlBinding;
}

/** Baresi'nin kaybolduğu yanıt: 2 satır, ikisi de QID etiketli. */
const BARESI_COZULMEDI = [
  playerRow({
    player: "Q189984",
    label: "Q189984",
    countryCode: "IT",
    positionLabel: "libero",
  }),
  playerRow({
    player: "Q189984",
    label: "Q189984",
    countryCode: "IT",
    positionLabel: "savunma",
  }),
];

describe("etiketi çözülemeyen oyuncu", () => {
  it("ikinci geçiş olmadan DÜŞER — kusurun kendisi", () => {
    expect(playersFrom(BARESI_COZULMEDI)).toHaveLength(0);
  });

  it("bağlamaları ikinci geçiş için ayrılır", () => {
    const bindings = [
      ...BARESI_COZULMEDI,
      playerRow({ player: "Q615", label: "Lionel Messi", lang: "tr" }),
    ];

    expect(unlabeledPlayerBindings(bindings)).toHaveLength(2);
    expect(playerIdsOf(unlabeledPlayerBindings(bindings))).toEqual(["Q189984"]);
  });

  it("çözülmüş etiket ikinci geçişe GİRMEZ", () => {
    const bindings = [playerRow({ player: "Q615", label: "Lionel Messi" })];

    expect(unlabeledPlayerBindings(bindings)).toHaveLength(0);
  });

  it("oyuncu kimliği okunamayan satır ikinci geçişe girmez", () => {
    const bozuk = { playerLabel: { type: "literal", value: "Q1" } };

    expect(
      unlabeledPlayerBindings([bozuk as unknown as SparqlBinding]),
    ).toHaveLength(0);
  });

  it("ikinci geçişten gelen adla KURTARILIR, diğer alanları korunur", () => {
    const labels = new Map([["Q189984", "Franco Baresi"]]);
    const players = playersFrom(BARESI_COZULMEDI, labels);

    expect(players).toHaveLength(1);
    expect(players[0]?.name).toBe("Franco Baresi");
    // Ad dışındaki alanlar ilk geçişte zaten doğru gelmişti.
    expect(players[0]?.citizenships).toEqual(["IT"]);
    expect(players[0]?.position).toBe("defender");
  });

  it("ikinci geçiş de bulamazsa yine düşer — ama artık sayılabilir", () => {
    const players = playersFrom(BARESI_COZULMEDI, new Map());

    expect(players).toHaveLength(0);
    expect(playerIdsOf(unlabeledPlayerBindings(BARESI_COZULMEDI))).toEqual([
      "Q189984",
    ]);
  });

  it("yedek ad, ÇÖZÜLMÜŞ etiketi EZMEZ", () => {
    // Servis çözebildiyse onun değeri geçerlidir; ikinci geçiş yalnızca
    // boşluğu doldurur, tercih sırası kurmaz.
    const labels = new Map([["Q615", "Yanlış Ad"]]);
    const players = playersFrom(
      [playerRow({ player: "Q615", label: "Lionel Messi", lang: "tr" })],
      labels,
    );

    expect(players[0]?.name).toBe("Lionel Messi");
  });
});

describe("labelsFrom — ikinci geçişin yanıtı", () => {
  it("Türkçe tercih edilir, sıradan bağımsız", () => {
    const trOnce = labelsFrom([
      labelRow("Q11571", "Cristiano Ronaldo", "en"),
      labelRow("Q11571", "Cristiano Ronaldo (futbolcu)", "tr"),
    ]);
    const trFirst = labelsFrom([
      labelRow("Q11571", "Cristiano Ronaldo (futbolcu)", "tr"),
      labelRow("Q11571", "Cristiano Ronaldo", "en"),
    ]);

    expect(trOnce.get("Q11571")).toBe("Cristiano Ronaldo (futbolcu)");
    expect(trFirst.get("Q11571")).toBe("Cristiano Ronaldo (futbolcu)");
  });

  it("tek dil geldiyse o kullanılır", () => {
    const labels = labelsFrom([labelRow("Q615", "Lionel Messi", "en")]);

    expect(labels.get("Q615")).toBe("Lionel Messi");
  });

  it("adı QID olan satır ad SAYILMAZ", () => {
    // İkinci geçişte olmaması gereken bir durum; olursa kusur sessizce
    // "Q189984" adlı bir oyuncu üretirdi.
    const labels = labelsFrom([labelRow("Q189984", "Q189984", "en")]);

    expect(labels.size).toBe(0);
  });

  it("boş yanıt boş eşleme verir", () => {
    expect(labelsFrom([]).size).toBe(0);
  });
});

describe("playerLabels sorgusu", () => {
  it("etiket servisini KULLANMAZ — ikinci yol olmasının şartı budur", () => {
    const query = playerLabels(["Q11571", "Q615"]);

    expect(query).not.toContain("wikibase:label");
    expect(query).toContain("rdfs:label");
    expect(query).toContain("wd:Q11571");
    expect(query).toContain("wd:Q615");
  });

  /**
   * `mul` ŞART. Ölçüldü (22 Ağustos 2026): Q11571'in 96 dilde etiketi var
   * ama `en` de `tr` de yok — ad `mul`'da duruyor. Bu satır düşerse Cristiano
   * Ronaldo bir sonraki koşuda yine kaybolur.
   */
  it("mul dilini de ister", () => {
    expect(playerLabels(["Q1"])).toContain(
      'LANG(?label) IN ("tr", "en", "mul")',
    );
  });
});

describe("etiket servisinin dil listesi", () => {
  /**
   * ASIL DÜZELTME BU SATIRDIR. Ölçüldü (22 Ağustos 2026): Q11571'in 96,
   * Q615'in 100 dilde etiketi var ama hiçbirinde `en` ya da `tr` yok — ad
   * `mul`'a taşınmış. `"tr,en"` diyen sorgu ikisini de adsız sanıp düşürdü.
   */
  it("oyuncu sorgusu mul'u da ister", () => {
    expect(playerDetails(["Q11571"])).toContain(
      'wikibase:language "tr,en,mul"',
    );
  });

  /**
   * Kulüpte örnek HENÜZ çıkmadı ama aynı göç aynı yerden geçecek ve bedeli
   * daha ağır: adsız kalan bir kulüp BÜTÜN dönemlerini götürür.
   */
  it("kulüp sorgusu da mul'u ister", () => {
    expect(clubsByLeagueLink("Q9448")).toContain(
      'wikibase:language "tr,en,mul"',
    );
  });

  it("sıra korunur: tr en özgülü, mul kanonik ad", () => {
    // `mul` başa alınırsa Türkçe adı olan varlıklarda dilden bağımsız biçim
    // kazanır ve site kendi dilindeki adı kaybeder.
    expect(playerDetails(["Q1"])).not.toContain('wikibase:language "mul');
  });
});
