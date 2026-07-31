import { describe, expect, it } from "vitest";
import {
  applyPlayerStats,
  nationalCapsFrom,
  physicalFrom,
  type NormalizedPlayer,
} from "../../../scripts/etl/pipeline/normalize";
import type { SparqlBinding } from "../../../scripts/etl/sources/wikidata/schemas";

/** §9.2 — oyuncu istatistikleri (BR-14). */

const ENTITY = "http://www.wikidata.org/entity/";

function capRow(player: string, team: string, caps: number): SparqlBinding {
  return {
    player: { type: "uri", value: `${ENTITY}${player}` },
    team: { type: "uri", value: `${ENTITY}${team}` },
    caps: { type: "literal", value: String(caps) },
  };
}

/** Ölçümde kullanılan gerçek takım kimlikleri. */
const ITALY = "Q676899";
const ITALY_U21 = "Q922698";
const SPAIN = "Q42267";
const BASQUE = "Q1211601";
const CLUB = "Q1422"; // Juventus — millî takım DEĞİL

const isNationalTeam = (team: string) =>
  [ITALY, ITALY_U21, SPAIN, BASQUE].includes(team);

describe("nationalCapsFrom — BR-14", () => {
  /**
   * TOPLAMA YANLIŞ, ölçüldü. U-21 takımları A millî takımla aynı Wikidata
   * sınıfını paylaşıyor; toplama Buffon'a 187 verirken doğrusu 176.
   */
  it("U-21 maçlarını A millî maçlara EKLEMEZ", () => {
    const caps = nationalCapsFrom(
      [capRow("Q68060", ITALY, 176), capRow("Q68060", ITALY_U21, 11)],
      isNationalTeam,
    );

    expect(caps.get("Q68060")).toBe(176);
  });

  /**
   * Bask Bölgesi gerçek bir millî takım, sadece FIFA üyesi değil. Toplama
   * Zubizarreta'ya 130 verirken doğrusu 126.
   */
  it("FIFA dışı ikinci millî takımı EKLEMEZ", () => {
    const caps = nationalCapsFrom(
      [capRow("Q215963", SPAIN, 126), capRow("Q215963", BASQUE, 4)],
      isNationalTeam,
    );

    expect(caps.get("Q215963")).toBe(126);
  });

  it("kulüp dönemlerini saymaz", () => {
    const caps = nationalCapsFrom(
      [capRow("Q68060", CLUB, 509), capRow("Q68060", ITALY, 176)],
      isNationalTeam,
    );

    expect(caps.get("Q68060")).toBe(176);
  });

  it("hiç millî takım kaydı yoksa oyuncu haritaya girmez", () => {
    const caps = nationalCapsFrom([capRow("Q1", CLUB, 300)], isNationalTeam);

    expect(caps.has("Q1")).toBe(false);
  });

  it("sırası ne olursa olsun en büyüğü seçer", () => {
    const artan = nationalCapsFrom(
      [capRow("Q1", ITALY_U21, 11), capRow("Q1", ITALY, 176)],
      isNationalTeam,
    );
    const azalan = nationalCapsFrom(
      [capRow("Q1", ITALY, 176), capRow("Q1", ITALY_U21, 11)],
      isNationalTeam,
    );

    expect(artan.get("Q1")).toBe(176);
    expect(azalan.get("Q1")).toBe(176);
  });

  it("bozuk satırları atlar", () => {
    const caps = nationalCapsFrom(
      [
        { player: { type: "uri", value: `${ENTITY}Q1` } },
        capRow("Q1", ITALY, 50),
        {
          player: { type: "uri", value: `${ENTITY}Q1` },
          team: { type: "uri", value: `${ENTITY}${ITALY}` },
          caps: { type: "literal", value: "sayı-değil" },
        },
      ],
      isNationalTeam,
    );

    expect(caps.get("Q1")).toBe(50);
  });
});

describe("physicalFrom — akla yatkın aralık", () => {
  function row(player: string, height?: number, mass?: number): SparqlBinding {
    return {
      player: { type: "uri", value: `${ENTITY}${player}` },
      ...(height === undefined
        ? {}
        : { height: { type: "literal", value: String(height) } }),
      ...(mass === undefined
        ? {}
        : { mass: { type: "literal", value: String(mass) } }),
    };
  }

  it("normal değerleri geçirir", () => {
    const result = physicalFrom([row("Q68060", 192, 92)]);

    expect(result.get("Q68060")).toEqual({ heightCm: 192, weightKg: 92 });
  });

  /**
   * Wikidata'da birim karışıklığı olur (metre yerine cm, pound yerine kg).
   * Aralık dışı bir değer "bilinmiyor"dan KÖTÜDÜR: kullanıcıya 2 cm boyunda
   * bir futbolcu gösterilir (§2.7).
   */
  it("aralık dışı değeri null yapar", () => {
    expect(physicalFrom([row("Q1", 2, 92)]).get("Q1")?.heightCm).toBeNull();
    expect(physicalFrom([row("Q2", 192, 3)]).get("Q2")?.weightKg).toBeNull();
    expect(physicalFrom([row("Q3", 500, 92)]).get("Q3")?.heightCm).toBeNull();
  });

  it("eksik alanı null yapar", () => {
    expect(physicalFrom([row("Q1", 180)]).get("Q1")).toEqual({
      heightCm: 180,
      weightKg: null,
    });
  });
});

describe("applyPlayerStats", () => {
  const base: NormalizedPlayer = {
    wikidataId: "Q68060",
    name: "Gianluigi Buffon",
    searchKey: "gianluigi buffon",
    birthDate: null,
    nationality: "IT",
    position: "Kaleci",
    genderQid: null,
    nationalCaps: null,
    heightCm: null,
    weightKg: null,
  };

  it("istatistikleri oyuncuya işler", () => {
    const [player] = applyPlayerStats(
      [base],
      new Map([["Q68060", 176]]),
      new Map([["Q68060", { heightCm: 192, weightKg: 92 }]]),
    );

    expect(player).toMatchObject({
      nationalCaps: 176,
      heightCm: 192,
      weightKg: 92,
      name: "Gianluigi Buffon",
    });
  });

  /** Eksik istatistik oyuncuyu DÜŞÜRMEZ; yalnızca o alanı boş bırakır. */
  it("istatistiği olmayan oyuncuyu korur", () => {
    const [player] = applyPlayerStats([base], new Map(), new Map());

    expect(player).toMatchObject({
      wikidataId: "Q68060",
      nationalCaps: null,
      heightCm: null,
      weightKg: null,
    });
  });

  it("girdiyi DEĞİŞTİRMEZ", () => {
    applyPlayerStats([base], new Map([["Q68060", 176]]), new Map());

    expect(base.nationalCaps).toBeNull();
  });
});
