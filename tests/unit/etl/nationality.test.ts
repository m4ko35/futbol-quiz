import { describe, expect, it } from "vitest";
import {
  nationalCapsFrom,
  nationalTeamCountriesFrom,
  pickNationality,
  playersFrom,
} from "../../../scripts/etl/pipeline/normalize";
import type { SparqlBinding } from "../../../scripts/etl/sources/wikidata/schemas";

/**
 * BR-38 — futbol uyruğu, hukuki vatandaşlık değil (§5.3.1).
 *
 * BU TESTLERİN TUTTUĞU ŞEY, ölçülmüş bir kusurun geri gelmemesi: `P27`
 * (vatandaşlık) çok değerlidir ve seçen bir kural yokken sonuncusu
 * kazanıyordu — Messi İspanyol, Icardi İtalyan görünüyordu. Aşağıdaki
 * oyuncular §5.3.1'de CANLI Wikidata sorgusuyla ölçüldü; sayılar uydurma
 * değil, o ölçümün kendisi.
 */

const uri = (qid: string): string => `http://www.wikidata.org/entity/${qid}`;

function playerRow(fields: {
  player: string;
  label?: string;
  countryCode?: string;
  birthCountryCode?: string;
  positionLabel?: string;
}): SparqlBinding {
  const binding: Record<string, { type: string; value: string }> = {
    player: { type: "uri", value: uri(fields.player) },
    playerLabel: { type: "literal", value: fields.label ?? "Oyuncu" },
  };
  if (fields.countryCode !== undefined) {
    binding["countryCode"] = { type: "literal", value: fields.countryCode };
  }
  if (fields.birthCountryCode !== undefined) {
    binding["birthCountryCode"] = {
      type: "literal",
      value: fields.birthCountryCode,
    };
  }
  if (fields.positionLabel !== undefined) {
    binding["positionLabel"] = {
      type: "literal",
      value: fields.positionLabel,
    };
  }
  return binding as unknown as SparqlBinding;
}

describe("playersFrom — çok satırlı oyuncu tek kayda iner", () => {
  /**
   * ÖLÇÜLMÜŞ KUSUR (§5.3.1). Messi üç satır döndürüyor (AR, IT, ES) ve eski
   * kod üçünü ayrı kayıt yapıp diziye ekliyordu; yükleyici sonuncusunu
   * yazdığı için `ES` kalıyordu.
   */
  it("Messi'nin ÜÇ vatandaşlığı tek kayıtta toplanır", () => {
    const players = playersFrom([
      playerRow({
        player: "Q615",
        label: "Lionel Messi",
        countryCode: "AR",
        birthCountryCode: "AR",
      }),
      playerRow({
        player: "Q615",
        label: "Lionel Messi",
        countryCode: "IT",
        birthCountryCode: "AR",
      }),
      playerRow({
        player: "Q615",
        label: "Lionel Messi",
        countryCode: "ES",
        birthCountryCode: "AR",
      }),
    ]);

    expect(players).toHaveLength(1);
    expect(players[0]?.citizenships).toEqual(["AR", "ES", "IT"]);
    expect(players[0]?.birthCountry).toBe("AR");
    // Seçim burada YAPILMAZ: millî takım henüz bilinmiyor.
    expect(players[0]?.nationality).toBeNull();
  });

  it("farklı oyuncular ayrı kayıt kalır", () => {
    const players = playersFrom([
      playerRow({ player: "Q615", countryCode: "AR" }),
      playerRow({ player: "Q136986", countryCode: "IT" }),
    ]);

    expect(players).toHaveLength(2);
  });

  it("vatandaşlığı olmayan oyuncu DÜŞMEZ", () => {
    // Eksik meta veri dışlama gerekçesi değildir (BR-7 ile aynı yön).
    const players = playersFrom([playerRow({ player: "Q1", label: "Kimse" })]);

    expect(players).toHaveLength(1);
    expect(players[0]?.citizenships).toEqual([]);
  });

  it("ilk dolu mevki korunur — boş satır onu ezmez", () => {
    const players = playersFrom([
      playerRow({
        player: "Q1",
        countryCode: "TR",
        positionLabel: "goalkeeper",
      }),
      playerRow({ player: "Q1", countryCode: "DE" }),
    ]);

    expect(players[0]?.position).toBe("Kaleci");
  });
});

describe("pickNationality — BR-38 kademeleri", () => {
  /**
   * Millî takım BİRİNCİ kademe ve gerekçesi ölçüm: Thiago Motta ile Diego
   * Costa Brezilya doğumlu Brezilya vatandaşı, ama İtalya ve İspanya millî
   * takımlarında oynadılar. Doğum yeri ya da vatandaşlık seçilseydi ikisi de
   * Brezilyalı görünürdü.
   */
  it("millî takım her şeyi yener", () => {
    expect(
      pickNationality({
        citizenships: ["BR", "IT"],
        nationalTeamCountry: "IT",
        birthCountry: "BR",
      }),
    ).toBe("IT");

    expect(
      pickNationality({
        citizenships: ["AR", "ES", "IT"],
        nationalTeamCountry: "AR",
        birthCountry: "AR",
      }),
    ).toBe("AR");
  });

  it("millî takımı olmayan tek vatandaşlıkta o vatandaşlık", () => {
    expect(
      pickNationality({
        citizenships: ["TR"],
        nationalTeamCountry: null,
        birthCountry: null,
      }),
    ).toBe("TR");
  });

  /** İkinci kademe: Icardi millî takımı olmasaydı doğum ülkesi ayırırdı. */
  it("millî takım yoksa doğum ülkesi ayırır", () => {
    expect(
      pickNationality({
        citizenships: ["AR", "IT"],
        nationalTeamCountry: null,
        birthCountry: "AR",
      }),
    ).toBe("AR");
  });

  /**
   * Son kademe BELİRLENİMCİDİR ama doğru olduğunu İDDİA ETMEZ. Amacı tek:
   * aynı veriyle her koşuda aynı sonuç. Eski davranış Wikidata'nın satır
   * sırasına bağlıydı, yani iki koşu iki farklı uyruk verebilirdi.
   */
  it("hiçbiri ayırmıyorsa sonuç HER KOŞUDA aynı", () => {
    const input = {
      citizenships: ["IT", "AR", "ES"],
      nationalTeamCountry: null,
      birthCountry: "FR",
    } as const;

    expect(pickNationality(input)).toBe("AR");
    expect(pickNationality(input)).toBe("AR");
    // Satır sırası değişse bile aynı: sıralama yapılıyor.
    expect(
      pickNationality({ ...input, citizenships: ["ES", "IT", "AR"] }),
    ).toBe("AR");
  });

  it("vatandaşlık yoksa null", () => {
    expect(
      pickNationality({
        citizenships: [],
        nationalTeamCountry: null,
        birthCountry: "TR",
      }),
    ).toBeNull();
  });

  /** Doğum ülkesi vatandaşlıklar arasında DEĞİLSE ona atlanmaz. */
  it("doğum ülkesi vatandaşlık değilse kullanılmaz", () => {
    expect(
      pickNationality({
        citizenships: ["FR", "SN"],
        nationalTeamCountry: null,
        birthCountry: "DE",
      }),
    ).toBe("FR");
  });
});

describe("nationalTeamCountriesFrom", () => {
  const teamRow = (
    team: string,
    sport?: string,
    admin?: string,
  ): SparqlBinding => {
    const binding: Record<string, { type: string; value: string }> = {
      team: { type: "uri", value: uri(team) },
    };
    if (sport !== undefined) {
      binding["sportCountryCode"] = { type: "literal", value: sport };
    }
    if (admin !== undefined) {
      binding["adminCountryCode"] = { type: "literal", value: admin };
    }
    return binding as unknown as SparqlBinding;
  };

  it("`P1532` varsa onu, yoksa `P17`'yi alır", () => {
    const map = nationalTeamCountriesFrom([
      teamRow("Q79800", "AR", "AR"), // Arjantin
      teamRow("Q47762", undefined, "GB"), // İngiltere → GB
    ]);

    expect(map.get("Q79800")).toBe("AR");
    expect(map.get("Q47762")).toBe("GB");
  });

  /** Kodu olmayan takım haritaya girmez; uyruk bir sonraki kademeye düşer. */
  it("ülke kodu olmayan takımı ATLAR", () => {
    const map = nationalTeamCountriesFrom([teamRow("Q189570")]);

    expect(map.has("Q189570")).toBe(false);
  });

  it("aynı takımın satırlarında `P1532` kazanır", () => {
    const map = nationalTeamCountriesFrom([
      teamRow("Q1", undefined, "XX"),
      teamRow("Q1", "YY", "XX"),
    ]);

    expect(map.get("Q1")).toBe("YY");
  });
});

describe("nationalCapsFrom — takım kimliği de döner", () => {
  const capsRow = (player: string, team: string, caps: number): SparqlBinding =>
    ({
      player: { type: "uri", value: uri(player) },
      team: { type: "uri", value: uri(team) },
      caps: { type: "literal", value: String(caps) },
    }) as unknown as SparqlBinding;

  it("en çok maç yapılan takımı ve sayısını verir", () => {
    // BR-14: toplama değil en büyük. Takım kimliği BR-38 için gerekli.
    const map = nationalCapsFrom(
      [
        capsRow("Q68060", "Q1088902", 176), // İtalya A
        capsRow("Q68060", "Q680791", 11), // İtalya U-21
      ],
      () => true,
    );

    expect(map.get("Q68060")).toEqual({ caps: 176, teamQid: "Q1088902" });
  });

  it("millî takım olmayanı eler", () => {
    const map = nationalCapsFrom([capsRow("Q1", "Q999", 50)], () => false);

    expect(map.size).toBe(0);
  });
});
