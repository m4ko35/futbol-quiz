import { describe, expect, it } from "vitest";
import type { GridRoomDto } from "@/application/use-cases/grid-rooms";
import { gridPollPhase, gridPollSignature } from "@/lib/grid-room-polling";

/**
 * §12.9 — Izgara (XOX) odası yoklama siyaseti (§12.1 karşılığı).
 */

function bosBoard(): GridRoomDto["board"] {
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => ({ kind: "bos" }) as const),
  );
}

function oda(patch: Partial<GridRoomDto> = {}): GridRoomDto {
  return {
    mode: "izgara",
    code: "BCDFGH",
    status: "oynaniyor",
    expiresAt: "2026-09-24T11:00:00.000Z",
    rows: [],
    columns: [],
    me: { displayName: "Ben", mark: "X" },
    opponent: { displayName: "Rakip", mark: "O" },
    board: bosBoard(),
    yourTurn: true,
    outcome: "devam",
    ...patch,
  };
}

describe("gridPollPhase", () => {
  it("bekleyen oda lobi", () => {
    expect(gridPollPhase(oda({ status: "bekliyor" }))).toBe("lobi");
  });

  it("sıra bendeyken oynuyorum", () => {
    expect(gridPollPhase(oda({ yourTurn: true }))).toBe("oynuyorum");
  });

  it("sıra rakipteyken rakibi-bekliyorum (hızlı)", () => {
    expect(gridPollPhase(oda({ yourTurn: false }))).toBe("rakibi-bekliyorum");
  });

  it("biten/sönen oda yoklanmaz (null)", () => {
    expect(gridPollPhase(oda({ status: "bitti" }))).toBeNull();
    expect(gridPollPhase(oda({ status: "suresi-doldu" }))).toBeNull();
  });
});

describe("gridPollSignature", () => {
  it("sıra dönünce imza değişir", () => {
    const before = gridPollSignature(oda({ yourTurn: false }));
    const after = gridPollSignature(oda({ yourTurn: true }));
    expect(after).not.toBe(before);
  });

  it("tahtaya bir hamle düşünce imza değişir", () => {
    const before = gridPollSignature(oda());
    const board = bosBoard().map((row) => [...row]);
    board[0]![0] = {
      kind: "kapali",
      mark: "O",
      playerName: "X",
      mine: false,
    };
    const after = gridPollSignature(oda({ board }));
    expect(after).not.toBe(before);
  });

  it("aynı durum aynı imzayı verir (yoklama yavaşlayabilsin)", () => {
    expect(gridPollSignature(oda())).toBe(gridPollSignature(oda()));
  });
});
