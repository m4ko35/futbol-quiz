import { describe, expect, it } from "vitest";
import {
  cellKey,
  GRID_SIZE,
  hasDistinctCriteria,
  isCellPlayable,
  isCellRefInRange,
  isGameOver,
  isGridShapeValid,
  isPlayerAlreadyUsed,
  isSameCriterion,
  MAX_CELL_ANSWERS,
  MAX_GUESSES,
  MIN_CELL_ANSWERS,
  type Grid,
  type GridCriterion,
} from "@/domain/services/grid";
import { clubId, playerId } from "@/domain/value-objects/identifiers";

/** §9.1 — ızgara kuralları (BR-9…BR-13). */

function club(id: string): GridCriterion {
  return { type: "club", clubId: clubId(id), label: id };
}

function nation(code: string): GridCriterion {
  return { type: "nationality", code, label: code };
}

describe("isSameCriterion", () => {
  it("aynı kulüp aynı kriterdir", () => {
    expect(isSameCriterion(club("a"), club("a"))).toBe(true);
    expect(isSameCriterion(club("a"), club("b"))).toBe(false);
  });

  it("aynı ülke aynı kriterdir", () => {
    expect(isSameCriterion(nation("TR"), nation("TR"))).toBe(true);
    expect(isSameCriterion(nation("TR"), nation("DE"))).toBe(false);
  });

  /**
   * Türler farklıysa kimlikler çakışsa bile aynı kriter değildir: "TR" kodlu
   * bir ülke ile "TR" kimlikli bir kulüp farklı sorular sorar.
   */
  it("tür farklıysa aynı değildir", () => {
    expect(isSameCriterion(club("TR"), nation("TR"))).toBe(false);
  });
});

describe("isCellPlayable — BR-9", () => {
  it("sınırların ikisi de DÂHİLDİR", () => {
    expect(isCellPlayable(MIN_CELL_ANSWERS)).toBe(true);
    expect(isCellPlayable(MAX_CELL_ANSWERS)).toBe(true);
  });

  it("sınırların dışı oynanamaz", () => {
    expect(isCellPlayable(MIN_CELL_ANSWERS - 1)).toBe(false);
    expect(isCellPlayable(MAX_CELL_ANSWERS + 1)).toBe(false);
  });

  it("boş hücre oynanamaz", () => {
    expect(isCellPlayable(0)).toBe(false);
  });
});

describe("hasDistinctCriteria", () => {
  it("tekrarsız ekseni kabul eder", () => {
    expect(hasDistinctCriteria([club("a"), club("b"), nation("TR")])).toBe(
      true,
    );
  });

  it("tekrar eden kriteri reddeder", () => {
    expect(hasDistinctCriteria([club("a"), club("b"), club("a")])).toBe(false);
  });
});

describe("isGridShapeValid", () => {
  const valid: Grid = {
    rows: [club("r1"), club("r2"), nation("TR")],
    columns: [club("c1"), club("c2"), club("c3")],
  };

  it("geçerli ızgarayı kabul eder", () => {
    expect(isGridShapeValid(valid)).toBe(true);
  });

  it("eksik satır/sütun reddedilir", () => {
    expect(isGridShapeValid({ ...valid, rows: valid.rows.slice(0, 2) })).toBe(
      false,
    );
    expect(
      isGridShapeValid({ ...valid, columns: valid.columns.slice(0, 2) }),
    ).toBe(false);
  });

  /**
   * "Barcelona × Barcelona" hücresi bir soru değildir; kriterin hem satırda hem
   * sütunda bulunması ızgarayı bozar.
   */
  it("bir kriter hem satırda hem sütunda olamaz", () => {
    expect(
      isGridShapeValid({
        rows: [club("c1"), club("r2"), nation("TR")],
        columns: valid.columns,
      }),
    ).toBe(false);
  });

  it("aynı eksende tekrar reddedilir", () => {
    expect(
      isGridShapeValid({
        rows: [club("r1"), club("r1"), nation("TR")],
        columns: valid.columns,
      }),
    ).toBe(false);
  });
});

describe("isCellRefInRange", () => {
  it("ızgara içindeki hücreleri kabul eder", () => {
    expect(isCellRefInRange({ row: 0, column: 0 })).toBe(true);
    expect(
      isCellRefInRange({ row: GRID_SIZE - 1, column: GRID_SIZE - 1 }),
    ).toBe(true);
  });

  it("aralık dışını reddeder", () => {
    expect(isCellRefInRange({ row: -1, column: 0 })).toBe(false);
    expect(isCellRefInRange({ row: 0, column: GRID_SIZE })).toBe(false);
  });

  /**
   * Tam sayı olmayan koordinat istemciden gelebilir; dizi indeksi olarak
   * kullanılırsa sessizce `undefined` verir.
   */
  it("tam sayı olmayanı reddeder", () => {
    expect(isCellRefInRange({ row: 1.5, column: 0 })).toBe(false);
    expect(isCellRefInRange({ row: Number.NaN, column: 0 })).toBe(false);
  });
});

describe("isPlayerAlreadyUsed — BR-10", () => {
  const used = new Map([
    ["0:0", playerId("p1")],
    ["1:1", playerId("p2")],
  ]);

  it("başka hücrede kullanılmış oyuncuyu yakalar", () => {
    expect(
      isPlayerAlreadyUsed(used, playerId("p1"), { row: 2, column: 2 }),
    ).toBe(true);
  });

  /**
   * Hedef hücrenin KENDİ cevabı "kullanılmış" sayılmaz; aksi hâlde bir hücreyi
   * aynı oyuncuyla güncellemek imkânsız olurdu.
   */
  it("hedef hücrenin kendi cevabını saymaz", () => {
    expect(
      isPlayerAlreadyUsed(used, playerId("p1"), { row: 0, column: 0 }),
    ).toBe(false);
  });

  it("hiç kullanılmamış oyuncu serbesttir", () => {
    expect(
      isPlayerAlreadyUsed(used, playerId("p9"), { row: 0, column: 1 }),
    ).toBe(false);
  });
});

describe("isGameOver — BR-13", () => {
  it("dokuz hak tükenince biter", () => {
    expect(isGameOver(MAX_GUESSES, 0)).toBe(true);
    expect(isGameOver(MAX_GUESSES - 1, 0)).toBe(false);
  });

  it("dokuz hücre de çözülünce biter", () => {
    expect(isGameOver(0, GRID_SIZE * GRID_SIZE)).toBe(true);
  });

  it("hak sayısı hücre sayısından türetilir", () => {
    expect(MAX_GUESSES).toBe(GRID_SIZE * GRID_SIZE);
  });
});

describe("cellKey", () => {
  it("satır ve sütunu ayırt eder", () => {
    expect(cellKey({ row: 0, column: 1 })).not.toBe(
      cellKey({ row: 1, column: 0 }),
    );
  });
});
