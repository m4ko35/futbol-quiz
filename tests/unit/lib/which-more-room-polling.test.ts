import { describe, expect, it } from "vitest";
import type {
  WhichMoreOpponentDto,
  WhichMoreRoomDto,
} from "@/application/use-cases/which-more-rooms";
import {
  whichMorePollPhase,
  whichMorePollSignature,
} from "@/lib/which-more-room-polling";

/**
 * §12.8 — Hangisi Daha odası yoklama siyaseti (§12.1 karşılığı).
 */

function opponent(
  patch: Partial<WhichMoreOpponentDto> = {},
): WhichMoreOpponentDto {
  return {
    displayName: "Rakip",
    eliminated: false,
    answered: null,
    streak: null,
    correct: null,
    picks: null,
    ...patch,
  };
}

function oda(patch: Partial<WhichMoreRoomDto> = {}): WhichMoreRoomDto {
  return {
    mode: "hangisi-daha",
    code: "BCDFGH",
    status: "oynaniyor",
    expiresAt: "2026-09-23T11:00:00.000Z",
    submode: "ani-olum",
    statKey: "goals",
    level: "easy",
    direction: "more",
    n: null,
    me: {
      displayName: "Ben",
      answered: 0,
      streak: 0,
      correct: 0,
      eliminated: false,
      picks: null,
    },
    opponent: opponent(),
    currentDuel: {
      left: { id: "a", name: "A", clubs: [] },
      right: { id: "b", name: "B", clubs: [] },
    },
    currentRoundIndex: 0,
    outcome: "devam",
    ...patch,
  };
}

describe("whichMorePollPhase", () => {
  it("bekleyen oda lobi", () => {
    expect(whichMorePollPhase(oda({ status: "bekliyor" }))).toBe("lobi");
  });

  it("oynayan ve düellosu olan oda oynuyorum", () => {
    expect(whichMorePollPhase(oda())).toBe("oynuyorum");
  });

  it("koşusu biten (düello yok) oyuncu rakibi-bekliyorum", () => {
    expect(
      whichMorePollPhase(oda({ currentDuel: null, currentRoundIndex: null })),
    ).toBe("rakibi-bekliyorum");
  });

  it("biten/sönen oda yoklanmaz (null)", () => {
    expect(whichMorePollPhase(oda({ status: "bitti" }))).toBeNull();
    expect(whichMorePollPhase(oda({ status: "suresi-doldu" }))).toBeNull();
  });
});

describe("whichMorePollSignature", () => {
  it("kendi ilerleyişim imzayı değiştirir", () => {
    const before = whichMorePollSignature(oda());
    const after = whichMorePollSignature(
      oda({
        me: {
          displayName: "Ben",
          answered: 1,
          streak: 1,
          correct: 1,
          eliminated: false,
          picks: null,
        },
      }),
    );
    expect(after).not.toBe(before);
  });

  it("rakibin elenmesi imzayı değiştirir (Ani ölüm)", () => {
    const before = whichMorePollSignature(oda());
    const after = whichMorePollSignature(
      oda({ opponent: opponent({ eliminated: true }) }),
    );
    expect(after).not.toBe(before);
  });

  it("Sabit N'de rakibin ilerlemesi imzayı değiştirir", () => {
    const before = whichMorePollSignature(oda({ submode: "sabit-n", n: 5 }));
    const after = whichMorePollSignature(
      oda({ submode: "sabit-n", n: 5, opponent: opponent({ answered: 2 }) }),
    );
    expect(after).not.toBe(before);
  });
});
