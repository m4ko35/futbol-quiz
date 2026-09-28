import { describe, expect, it } from "vitest";
import type { CellRef } from "@/domain/services/grid";
import {
  boardAt,
  cellCount,
  gridRoomDeadline,
  gridRoomOutcome,
  gridRoomResult,
  gridRoomStatus,
  isBoardFull,
  isGridRoomDecided,
  judgeGridJoin,
  judgeGridMove,
  lineWinnerMark,
  markForSeat,
  markOf,
  nextSeat,
  whoseTurn,
  type GridMove,
  type GridRoomConfig,
  type GridRoomState,
} from "@/domain/services/grid-room";

/**
 * §12.9 — Izgara odası (XOX). Saf kural sınaması: tahta/sıra/galip türetimi ve
 * hamle yargısı. Izgaranın üretimi ve bir cevabın doğruluğu BURADA DEĞİL
 * (application); testler `correct`'i doğrudan kurar.
 */

const HOST = "host";
const GUEST = "guest";
const CREATED = new Date("2026-09-24T10:00:00.000Z");
const STARTED = new Date("2026-09-24T10:05:00.000Z");
/** Oynanırken — sönme pencerelerinin (30/60 dk) içinde. */
const NOW = new Date("2026-09-24T10:10:00.000Z");

function state(patch: Partial<GridRoomState> = {}): GridRoomState {
  const config: GridRoomConfig = { seed: 1, firstSeat: 0 };
  return {
    createdAt: CREATED,
    startedAt: STARTED,
    config,
    players: [
      { userId: HOST, displayName: "Ev" },
      { userId: GUEST, displayName: "Konuk" },
    ],
    moves: [],
    ...patch,
  };
}

function move(
  moveIndex: number,
  userId: string,
  row: number,
  column: number,
  correct: boolean,
): GridMove {
  return {
    moveIndex,
    userId,
    cell: { row, column },
    playerId: `p${String(moveIndex)}`,
    correct,
  };
}

/**
 * Sırayı otomatik veren yardımcı: `[userId, row, col, correct]` üçlülerini
 * `moveIndex`'e çevirir. Sıra doğruluğu ayrı testte; burada dizilim kolay olsun.
 */
function moves(
  ...list: readonly [string, number, number, boolean][]
): readonly GridMove[] {
  return list.map(([userId, row, column, correct], index) =>
    move(index, userId, row, column, correct),
  );
}

describe("işaret ataması (BR-76)", () => {
  it("firstSeat 0 iken koltuk 0 = X, koltuk 1 = O", () => {
    const config: GridRoomConfig = { seed: 1, firstSeat: 0 };
    expect(markForSeat(config, 0)).toBe("X");
    expect(markForSeat(config, 1)).toBe("O");
  });

  it("firstSeat 1 iken koltuk 1 = X, koltuk 0 = O", () => {
    const s = state({ config: { seed: 1, firstSeat: 1 } });
    expect(markOf(s, GUEST)).toBe("X");
    expect(markOf(s, HOST)).toBe("O");
  });

  it("üye olmayanın işareti yok", () => {
    expect(markOf(state(), "yabanci")).toBeNull();
  });
});

describe("boardAt (BR-73)", () => {
  it("doğru hamle hücreyi işaretle kapatır", () => {
    const board = boardAt(state({ moves: moves([HOST, 0, 0, true]) }));
    const cell = board[0]?.[0];
    expect(cell).toEqual({
      kind: "kapali",
      mark: "X",
      userId: HOST,
      playerId: "p0",
    });
  });

  it("yanlış hamle hücreyi öldürür (işaret yok)", () => {
    // Sıra host'ta; ama boardAt sırayı zorlamaz, yanlış hamleyi olduğu gibi oynar.
    const board = boardAt(state({ moves: moves([HOST, 1, 2, false]) }));
    expect(board[1]?.[2]).toEqual({
      kind: "olu",
      userId: HOST,
      playerId: "p0",
    });
  });

  it("boş hücreler 'bos' kalır", () => {
    const board = boardAt(state());
    expect(board.flat().every((cell) => cell.kind === "bos")).toBe(true);
  });
});

describe("sıra (BR-72)", () => {
  it("firstSeat 0: ilk sıra host, sonra sırayla değişir", () => {
    expect(whoseTurn(state())).toBe(HOST);
    expect(whoseTurn(state({ moves: moves([HOST, 0, 0, true]) }))).toBe(GUEST);
    expect(
      whoseTurn(
        state({ moves: moves([HOST, 0, 0, true], [GUEST, 1, 0, true]) }),
      ),
    ).toBe(HOST);
  });

  it("yanlış hamle de sırayı geçirir", () => {
    // Host yanlış oynadı → yine sıra guest'e geçer.
    expect(whoseTurn(state({ moves: moves([HOST, 0, 0, false]) }))).toBe(GUEST);
  });

  it("firstSeat 1: ilk sıra guest", () => {
    expect(whoseTurn(state({ config: { seed: 1, firstSeat: 1 } }))).toBe(GUEST);
  });

  it("iki oyuncu yoksa sıra yok", () => {
    const s = state({
      startedAt: null,
      players: [{ userId: HOST, displayName: "Ev" }],
    });
    expect(whoseTurn(s)).toBeNull();
  });

  it("nextSeat hamle sayısıyla değişir", () => {
    expect(nextSeat(state())).toBe(0);
    expect(nextSeat(state({ moves: moves([HOST, 0, 0, true]) }))).toBe(1);
  });
});

describe("galip: 3'lü sıra (BR-75)", () => {
  it("üst satırı X ile dolduran host çizgiyle kazanır", () => {
    const s = state({
      moves: moves(
        [HOST, 0, 0, true], // X
        [GUEST, 1, 0, true], // O
        [HOST, 0, 1, true], // X
        [GUEST, 1, 1, true], // O
        [HOST, 0, 2, true], // X → üst satır XXX
      ),
    });
    const result = gridRoomResult(s);
    expect(result).toEqual({
      kind: "galip",
      winnerId: HOST,
      winnerCells: 3,
      loserCells: 2,
      via: "cizgi",
    });
    expect(isGridRoomDecided(s)).toBe(true);
    // Kesinleşince sıra biter.
    expect(whoseTurn(s)).toBeNull();
  });

  it("köşegen de kazandırır", () => {
    const board = boardAt(
      state({
        moves: moves(
          [HOST, 0, 0, true],
          [GUEST, 0, 1, true],
          [HOST, 1, 1, true],
          [GUEST, 0, 2, true],
          [HOST, 2, 2, true], // (0,0)-(1,1)-(2,2) hepsi X
        ),
      }),
    );
    expect(lineWinnerMark(board)).toBe("X");
  });

  it("ölü hücre çizgiyi kırar", () => {
    const board = boardAt(
      state({
        moves: moves(
          [HOST, 0, 0, true], // X
          [GUEST, 2, 0, true], // O
          [HOST, 0, 1, false], // ölü — üst satırı kırar
        ),
      }),
    );
    expect(lineWinnerMark(board)).toBeNull();
  });
});

describe("galip: tahta dolunca çok hücre / beraberlik (BR-75)", () => {
  it("3'lüsüz dolan tahtada çok hücre kapan kazanır", () => {
    const s = state({
      moves: moves(
        [HOST, 0, 0, true], // X
        [GUEST, 0, 1, false], // ölü
        [HOST, 0, 2, true], // X
        [GUEST, 1, 0, false], // ölü
        [HOST, 1, 1, true], // X
        [GUEST, 1, 2, false], // ölü
        [HOST, 2, 0, false], // ölü
        [GUEST, 2, 1, true], // O
        [HOST, 2, 2, false], // ölü
      ),
    });
    const board = boardAt(s);
    expect(isBoardFull(board)).toBe(true);
    expect(cellCount(board, "X")).toBe(3);
    expect(cellCount(board, "O")).toBe(1);
    expect(gridRoomResult(s)).toEqual({
      kind: "galip",
      winnerId: HOST,
      winnerCells: 3,
      loserCells: 1,
      via: "hucre",
    });
  });

  it("eşit hücre sayısı beraberliktir", () => {
    const s = state({
      moves: moves(
        [HOST, 0, 0, true], // X
        [GUEST, 0, 1, true], // O
        [HOST, 0, 2, false], // ölü
        [GUEST, 1, 0, true], // O
        [HOST, 1, 1, false], // ölü
        [GUEST, 1, 2, false], // ölü
        [HOST, 2, 0, true], // X
        [GUEST, 2, 1, false], // ölü
        [HOST, 2, 2, false], // ölü
      ),
    });
    expect(gridRoomResult(s)).toEqual({ kind: "beraberlik", cells: 2 });
  });

  it("tahta dolmadan ve çizgi yokken karar yok", () => {
    const s = state({ moves: moves([HOST, 0, 0, true]) });
    expect(gridRoomResult(s)).toEqual({ kind: "devam" });
    expect(isGridRoomDecided(s)).toBe(false);
  });

  it("iki oyuncu yoksa sonuç 'devam'", () => {
    const s = state({ players: [{ userId: HOST, displayName: "Ev" }] });
    expect(gridRoomResult(s)).toEqual({ kind: "devam" });
  });
});

describe("hamle yargısı (BR-72/BR-73)", () => {
  const cell = (row: number, column: number): CellRef => ({ row, column });

  it("sırası gelen oyuncunun boş hücreye hamlesi 'izin'", () => {
    expect(judgeGridMove(state(), HOST, cell(0, 0), NOW)).toEqual({
      kind: "izin",
      mark: "X",
    });
  });

  it("sırası gelmeyen 'sira-degil' alır", () => {
    expect(judgeGridMove(state(), GUEST, cell(0, 0), NOW)).toEqual({
      kind: "ret",
      reason: "sira-degil",
    });
  });

  it("dolu hücre 'hucre-dolu' (sıra denetiminden ÖNCE)", () => {
    // Host oynadı, sıra guest'te; guest dolu (0,0)'a basıyor → hücre-dolu.
    const s = state({ moves: moves([HOST, 0, 0, true]) });
    expect(judgeGridMove(s, GUEST, cell(0, 0), NOW)).toEqual({
      kind: "ret",
      reason: "hucre-dolu",
    });
  });

  it("aralık dışı hücre 'gecersiz-hucre'", () => {
    expect(judgeGridMove(state(), HOST, cell(3, 0), NOW)).toEqual({
      kind: "ret",
      reason: "gecersiz-hucre",
    });
  });

  it("başlamamış oda 'oda-kapali'", () => {
    const s = state({
      startedAt: null,
      players: [{ userId: HOST, displayName: "Ev" }],
    });
    expect(judgeGridMove(s, HOST, cell(0, 0), NOW).kind).toBe("ret");
    expect(judgeGridMove(s, HOST, cell(0, 0), NOW)).toEqual({
      kind: "ret",
      reason: "oda-kapali",
    });
  });

  it("sönmüş oda 'oda-kapali'", () => {
    // startedAt + 60 dk sonrası.
    const late = new Date("2026-09-24T11:06:00.000Z");
    expect(judgeGridMove(state(), HOST, cell(0, 0), late)).toEqual({
      kind: "ret",
      reason: "oda-kapali",
    });
  });

  it("kesinleşmiş maça hamle 'oda-kapali'", () => {
    const won = state({
      moves: moves(
        [HOST, 0, 0, true],
        [GUEST, 1, 0, true],
        [HOST, 0, 1, true],
        [GUEST, 1, 1, true],
        [HOST, 0, 2, true], // host kazandı
      ),
    });
    // Sıra guest'te değil (bitti); ne olursa olsun oda-kapali.
    expect(judgeGridMove(won, GUEST, cell(2, 2), NOW)).toEqual({
      kind: "ret",
      reason: "oda-kapali",
    });
  });
});

describe("durum / sonuç zamanla (BR-60/BR-61/BR-75)", () => {
  it("başlamamış oda 'bekliyor', başlamış 'oynaniyor'", () => {
    expect(
      gridRoomStatus(
        state({
          startedAt: null,
          players: [{ userId: HOST, displayName: "Ev" }],
        }),
        NOW,
      ),
    ).toBe("bekliyor");
    expect(gridRoomStatus(state(), NOW)).toBe("oynaniyor");
  });

  it("kesinleşme saatten önce gelir — sönme penceresinde bile 'bitti'", () => {
    const won = state({
      startedAt: STARTED,
      moves: moves(
        [HOST, 0, 0, true],
        [GUEST, 1, 0, true],
        [HOST, 0, 1, true],
        [GUEST, 1, 1, true],
        [HOST, 0, 2, true],
      ),
    });
    const late = new Date("2026-09-24T11:30:00.000Z");
    expect(gridRoomStatus(won, late)).toBe("bitti");
  });

  it("yarım kalan (sönmüş, kesinleşmemiş) maçın galibi yok", () => {
    const late = new Date("2026-09-24T11:06:00.000Z");
    expect(
      gridRoomOutcome(state({ moves: moves([HOST, 0, 0, true]) }), late),
    ).toEqual({
      kind: "yarim",
    });
  });

  it("kesinleşmiş maçın sonucu outcome'a taşınır", () => {
    const won = state({
      moves: moves(
        [HOST, 0, 0, true],
        [GUEST, 1, 0, true],
        [HOST, 0, 1, true],
        [GUEST, 1, 1, true],
        [HOST, 0, 2, true],
      ),
    });
    expect(gridRoomOutcome(won, NOW)).toEqual({
      kind: "galip",
      winnerId: HOST,
      winnerCells: 3,
      loserCells: 2,
      via: "cizgi",
    });
  });

  it("deadline: başlamadan katılma penceresi, başladıktan oynama penceresi", () => {
    const waiting = state({ startedAt: null });
    expect(gridRoomDeadline(waiting).getTime()).toBe(
      CREATED.getTime() + 30 * 60 * 1000,
    );
    expect(gridRoomDeadline(state()).getTime()).toBe(
      STARTED.getTime() + 60 * 60 * 1000,
    );
  });
});

describe("katılma yargısı (BR-54)", () => {
  it("boş koltuklu bekleyen odaya yabancı katılabilir", () => {
    const waiting = state({
      startedAt: null,
      players: [{ userId: HOST, displayName: "Ev" }],
    });
    expect(judgeGridJoin(waiting, "yeni", NOW)).toEqual({ kind: "katil" });
  });

  it("üye tekrar katılmaya çalışınca 'zaten-uye' (ret değil)", () => {
    const waiting = state({
      startedAt: null,
      players: [{ userId: HOST, displayName: "Ev" }],
    });
    expect(judgeGridJoin(waiting, HOST, NOW)).toEqual({ kind: "zaten-uye" });
  });

  it("dolu oda 'oda-dolu' değil — başlamış oda 'oda-kapali'", () => {
    // İki oyuncu var, başlamış → durum 'oynaniyor', bekliyor değil.
    expect(judgeGridJoin(state(), "yeni", NOW)).toEqual({
      kind: "ret",
      reason: "oda-kapali",
    });
  });
});
