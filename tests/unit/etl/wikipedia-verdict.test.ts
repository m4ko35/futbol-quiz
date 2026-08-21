import { describe, expect, it } from "vitest";

import type { Contradiction } from "../../../scripts/etl/pipeline/cross-check";
import type { NormalizedSpell } from "../../../scripts/etl/pipeline/normalize";
import {
  applyVerdict,
  judgeContradictions,
  MIN_EVIDENCE_SITES,
} from "../../../scripts/etl/pipeline/wikipedia-verdict";

/**
 * §4.3 (4. kural), §8.2 — Vikipedi'nin reddetme yetkisi.
 *
 * BURADAKİ TESTLERİN ÖLÇÜTÜ iki gerçek vaka ve bir gerçek felaket:
 *
 *  · LEÃO — Wikidata'nın uydurduğu Real Madrid kaydı; tr ve en Milan diyor.
 *    Kapının VARLIK sebebi.
 *  · TEK DİL — kanıt tek topluluktan geliyorsa vandalizmi vandalizmle
 *    düzeltme riski var; karantina.
 *  · 70/66 — §4.3'ün 4. kuralı bir kez ölçmeden uygulanmış, 70 dönem
 *    ayıklanmış, 66'sı sağlam çıkmıştı. Kapının bir daha "sessizlik kanıttır"
 *    demediğini tutan test aşağıda: karar YALNIZCA çelişki listesinden
 *    beslenir, ki o liste zaten pozitif ifade istiyor.
 */

function celiski(over: Partial<Contradiction> = {}): Contradiction {
  return {
    playerWikidataId: "Q30055335",
    spellId: "Q30055335-390ce6af",
    clubWikidataId: "Q8682",
    startYear: 2019,
    endYear: null,
    appearances: 227,
    wikipediaClubs: ["Q1543"],
    wikipediaSites: ["tr", "en"],
    ...over,
  };
}

describe("Vikipedi'nin kararı", () => {
  it("LEÃO VAKASI: iki dil aynı şeyi söylüyorsa dönem REDDEDİLİR", () => {
    const sonuc = judgeContradictions({ contradictions: [celiski()] });

    expect(sonuc.candidates).toHaveLength(1);
    expect(sonuc.candidates[0]?.verdict).toBe("reddet");
    expect(sonuc.rejectedSpellIds.has("Q30055335-390ce6af")).toBe(true);
  });

  it("TEK DİL karantinadır — silinmez", () => {
    // Tek dil, tek topluluğun tek düzenlemesi. Wikidata kadar vandalizme
    // açık; birini ötekiyle düzeltmenin yolu yok.
    const sonuc = judgeContradictions({
      contradictions: [celiski({ wikipediaSites: ["tr"] })],
    });

    expect(sonuc.candidates[0]?.verdict).toBe("karantina");
    expect(sonuc.rejectedSpellIds.size).toBe(0);
  });

  it("karantina 'hafifçe sil' DEĞİLDİR", () => {
    // Ayrım kapının kendisi: karantina "karar veremedim" demek. Reddedilenler
    // kümesine sızarsa kapı sessizce tek dille silmeye başlar.
    const sonuc = judgeContradictions({
      contradictions: [
        celiski({ spellId: "a", wikipediaSites: ["tr"] }),
        celiski({ spellId: "b", wikipediaSites: ["en"] }),
        celiski({ spellId: "c", wikipediaSites: ["it"] }),
      ],
    });

    expect(sonuc.candidates.every((c) => c.verdict === "karantina")).toBe(true);
    expect(sonuc.rejectedSpellIds.size).toBe(0);
  });

  it("AYNI DİL iki kez sayılmaz", () => {
    // İki `tr` satırı iki topluluk değildir. Tekilleştirme olmasaydı, aynı
    // maddedeki iki kariyer satırı eşiği tek başına aşardı.
    const sonuc = judgeContradictions({
      contradictions: [celiski({ wikipediaSites: ["tr", "tr"] })],
    });

    expect(sonuc.candidates[0]?.evidenceSites).toEqual(["tr"]);
    expect(sonuc.candidates[0]?.verdict).toBe("karantina");
  });

  it("kanıt taşıyan diller SONUÇTA görünür", () => {
    // Gölge modun tek amacı bu listenin doğrulanabilmesi; kanıt gizlenirse
    // insan neye baktığını bilemez.
    const sonuc = judgeContradictions({
      contradictions: [celiski({ wikipediaSites: ["en", "de"] })],
    });

    expect(sonuc.candidates[0]?.evidenceSites).toEqual(["en", "de"]);
    expect(sonuc.candidates[0]?.wikipediaClubs).toEqual(["Q1543"]);
  });

  it("eşik dışarıdan verilebilir ama VARSAYILANI ikidir", () => {
    expect(MIN_EVIDENCE_SITES).toBe(2);

    const gevsek = judgeContradictions({
      contradictions: [celiski({ wikipediaSites: ["tr"] })],
      minSites: 1,
    });
    expect(gevsek.candidates[0]?.verdict).toBe("reddet");
  });

  it("çelişki yoksa karar da yoktur", () => {
    const sonuc = judgeContradictions({ contradictions: [] });

    expect(sonuc.candidates).toEqual([]);
    expect(sonuc.rejectedSpellIds.size).toBe(0);
  });

  it("GİRDİ SIRASI korunur", () => {
    // İki koşunun farkı ancak sıra sabitse okunabilir.
    const sonuc = judgeContradictions({
      contradictions: [
        celiski({ spellId: "1" }),
        celiski({ spellId: "2", wikipediaSites: ["tr"] }),
        celiski({ spellId: "3" }),
      ],
    });

    expect(sonuc.candidates.map((c) => c.spellId)).toEqual(["1", "2", "3"]);
  });
});

function donem(over: Partial<NormalizedSpell> = {}): NormalizedSpell {
  return {
    wikidataStatementId: "Q30055335-390ce6af",
    playerWikidataId: "Q30055335",
    clubWikidataId: "Q8682",
    startYear: 2019,
    endYear: null,
    isCurrent: true,
    isLoan: false,
    isYouth: false,
    appearances: 227,
    goals: 64,
    ...over,
  };
}

/**
 * Uygulama yolu — kararı VERMEK ile UYGULAMAK ayrı işler ve ikincisi veri
 * kaybettirir. §4.3'ün 4. kuralı bir kez ölçülmeden uygulanıp 66 sağlam
 * dönemi ayıklamıştı; bu yüzden yolun kendi testi var.
 */
describe("kararın uygulanması", () => {
  const sahte = judgeContradictions({ contradictions: [celiski()] });

  it("REDDEDİLEN dönem düşer, ötekiler DURUR", () => {
    const sonuc = applyVerdict({
      spells: [donem(), donem({ wikidataStatementId: "baska", goals: 1 })],
      contradictions: [celiski()],
      rejectedSpellIds: sahte.rejectedSpellIds,
    });

    expect(sonuc.spells.map((s) => s.wikidataStatementId)).toEqual(["baska"]);
    expect(sonuc.droppedCount).toBe(1);
  });

  it("çözülen çelişki listeden ÇIKAR — kapı kendi çözdüğü şeyde durmaz", () => {
    const sonuc = applyVerdict({
      spells: [donem()],
      contradictions: [celiski()],
      rejectedSpellIds: sahte.rejectedSpellIds,
    });

    expect(sonuc.contradictions).toEqual([]);
  });

  it("KARANTİNADAKİ çelişki listede KALIR", () => {
    // Çözülmemiş anlaşmazlık hâlâ yüklemeyi durdurmalı; karantina bir çözüm
    // değil, bir erteleme.
    const karantina = judgeContradictions({
      contradictions: [celiski({ wikipediaSites: ["tr"] })],
    });

    const sonuc = applyVerdict({
      spells: [donem()],
      contradictions: [celiski({ wikipediaSites: ["tr"] })],
      rejectedSpellIds: karantina.rejectedSpellIds,
    });

    expect(sonuc.spells).toHaveLength(1);
    expect(sonuc.contradictions).toHaveLength(1);
    expect(sonuc.droppedCount).toBe(0);
  });

  it("boş karar hiçbir şeye DOKUNMAZ", () => {
    const spells = [donem(), donem({ wikidataStatementId: "x" })];
    const sonuc = applyVerdict({
      spells,
      contradictions: [],
      rejectedSpellIds: new Set(),
    });

    expect(sonuc.spells).toEqual(spells);
    expect(sonuc.droppedCount).toBe(0);
  });

  it("GİRDİYİ değiştirmez", () => {
    // Saflık: çağıran hâlâ orijinal listeye bakabilmeli (gölge modda tam
    // olarak bunu yapıyor).
    const spells = [donem()];
    applyVerdict({
      spells,
      contradictions: [celiski()],
      rejectedSpellIds: sahte.rejectedSpellIds,
    });

    expect(spells).toHaveLength(1);
  });
});
