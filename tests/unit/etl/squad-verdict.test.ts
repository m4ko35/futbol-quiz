import { describe, expect, it } from "vitest";

import type { WikipediaSpell } from "../../../scripts/etl/pipeline/merge-wikipedia";
import {
  applySquadVerdict,
  MIN_SITES_FOR_DISCOVERED,
} from "../../../scripts/etl/pipeline/squad-verdict";
import type { WikiSite } from "../../../scripts/etl/sources/wikipedia/client";

/**
 * BR-60 — §4.3 Aşama 3.
 *
 * Kuralın bütün değeri KAPSAMININ DAR olmasında: Wikidata dayanağı olan bir
 * dönem tek dil yazsa bile dokunulmamalı, çünkü o dönemin ikinci kaynağı zaten
 * Wikidata'dır. Kapsam genişlerse kural, koruduğu şeyden çok veri siler.
 */
function spell(
  playerWikidataId: string,
  sites: readonly WikiSite[],
  clubWikidataId = "Q-club",
): WikipediaSpell {
  return {
    playerWikidataId,
    clubWikidataId,
    startYear: 2020,
    endYear: null,
    appearances: 50,
    goals: 3,
    isLoan: false,
    sites,
  };
}

describe("applySquadVerdict — BR-60", () => {
  const discovered = new Set(["Q-yeni"]);

  it("çıta ikidir", () => {
    expect(MIN_SITES_FOR_DISCOVERED).toBe(2);
  });

  it("iki dil yazdıysa kabul eder", () => {
    const result = applySquadVerdict({
      spells: [spell("Q-yeni", ["en", "de"])],
      discoveredIds: discovered,
    });

    expect(result.spells).toHaveLength(1);
    expect(result.quarantined).toHaveLength(0);
    expect(result.stats.playersAdmitted).toBe(1);
  });

  it("tek dil yazdıysa karantinaya alır", () => {
    const result = applySquadVerdict({
      spells: [spell("Q-yeni", ["en"])],
      discoveredIds: discovered,
    });

    expect(result.spells).toHaveLength(0);
    expect(result.quarantined).toHaveLength(1);
    expect(result.stats.quarantined).toBe(1);
    expect(result.stats.playersFullyQuarantined).toBe(1);
  });

  it("karantina SİLMEZ — kayıt listede durur", () => {
    const tek = spell("Q-yeni", ["en"]);
    const result = applySquadVerdict({
      spells: [tek],
      discoveredIds: discovered,
    });

    expect(result.quarantined[0]).toBe(tek);
  });

  it("KEŞFEDİLMEMİŞ oyuncuya dokunmaz, tek dil yazsa bile", () => {
    // Bu oyuncunun ikinci kaynağı zaten Wikidata; kural kapsamı dışında.
    const result = applySquadVerdict({
      spells: [spell("Q-eski", ["en"])],
      discoveredIds: discovered,
    });

    expect(result.spells).toHaveLength(1);
    expect(result.stats.discoveredRecords).toBe(0);
  });

  it("aynı dil iki kez sayılmaz", () => {
    const result = applySquadVerdict({
      spells: [spell("Q-yeni", ["en", "en"])],
      discoveredIds: discovered,
    });

    expect(result.quarantined).toHaveLength(1);
  });

  it("oyuncunun bir dönemi kabul, biri karantina olabilir", () => {
    const result = applySquadVerdict({
      spells: [
        spell("Q-yeni", ["en", "fr"], "Q-a"),
        spell("Q-yeni", ["en"], "Q-b"),
      ],
      discoveredIds: discovered,
    });

    expect(result.spells).toHaveLength(1);
    expect(result.quarantined).toHaveLength(1);
    expect(result.stats.playersAdmitted).toBe(1);
    expect(result.stats.playersFullyQuarantined).toBe(0);
  });

  it("hiç dönemi kabul edilmeyen oyuncu ayrı sayılır", () => {
    const result = applySquadVerdict({
      spells: [spell("Q-yeni", ["en"], "Q-a"), spell("Q-yeni", ["en"], "Q-b")],
      discoveredIds: discovered,
    });

    expect(result.stats.playersFullyQuarantined).toBe(1);
    expect(result.stats.playersAdmitted).toBe(0);
  });

  it("sayaçlar birbiriyle tutarlı", () => {
    const result = applySquadVerdict({
      spells: [
        spell("Q-yeni", ["en", "it"], "Q-a"),
        spell("Q-yeni", ["en"], "Q-b"),
        spell("Q-eski", ["en"], "Q-c"),
      ],
      discoveredIds: discovered,
    });

    expect(result.stats.discoveredRecords).toBe(2);
    expect(result.stats.admitted + result.stats.quarantined).toBe(
      result.stats.discoveredRecords,
    );
  });

  it("çıta çağıran tarafından yükseltilebilir", () => {
    const result = applySquadVerdict({
      spells: [spell("Q-yeni", ["en", "de"])],
      discoveredIds: discovered,
      minSites: 3,
    });

    expect(result.quarantined).toHaveLength(1);
  });
});
