import { describe, expect, it } from "vitest";
import {
  correctCount,
  FIXED_N_OPTIONS,
  isEliminated,
  isFixedN,
  isWhichMoreRoomDecided,
  isWhichMoreRoomFull,
  isWhichMoreSubmode,
  suddenDeathStreak,
  WHICH_MORE_SUBMODES,
  whichMoreRoomDeadline,
  whichMoreRoomOutcome,
  whichMoreRoomResult,
  whichMoreRoomStatus,
  type FixedN,
  type WhichMoreDuelAnswer,
  type WhichMoreRoomConfig,
  type WhichMoreRoomPlayer,
  type WhichMoreRoomState,
} from "@/domain/services/which-more-room";
import {
  ROOM_JOIN_WINDOW_MS,
  ROOM_PLAY_WINDOW_MS,
} from "@/domain/services/room";

/**
 * §12.8 BR-67…BR-70 — Hangisi Daha odasının SAF kuralları.
 *
 * ZAMAN HER YERDE PARAMETRE (`room.ts` ile aynı ilke): sönme ancak `now`
 * geçilerek sınanabilir. Rastgelelik ve veri erişimi burada yok — ray üretimi
 * ve puanlama girdileri hazır cevap dizileri olarak veriliyor.
 */

const KURULUS = new Date("2026-09-23T10:00:00.000Z");

/** İlk `k` doğru, ardından (varsa) bir yanlış — Ani ölüm koşusu şekli. */
function answers(corrects: readonly boolean[]): readonly WhichMoreDuelAnswer[] {
  return corrects.map((correct, index) => ({
    roundIndex: index,
    chosenId: `p${String(index)}`,
    correct,
  }));
}

const aniConfig: WhichMoreRoomConfig = {
  submode: "ani-olum",
  statKey: "goals",
  level: "easy",
  direction: "more",
  seed: 42,
};

const fixedConfig = (n: FixedN): WhichMoreRoomConfig => ({
  submode: "sabit-n",
  statKey: "appearances",
  level: "hard",
  direction: "more",
  seed: 42,
  n,
});

const player = (
  userId: string,
  corrects: readonly boolean[],
): WhichMoreRoomPlayer => ({
  userId,
  displayName: userId.toUpperCase(),
  answers: answers(corrects),
});

const room = (
  config: WhichMoreRoomConfig,
  players: readonly WhichMoreRoomPlayer[],
  startedAt: Date | null = KURULUS,
): WhichMoreRoomState => ({
  createdAt: KURULUS,
  startedAt,
  config,
  players,
});

describe("alt-mod ve N doğrulayıcıları (§12.8, BR-69)", () => {
  it("yalnızca iki alt-mod tanınır", () => {
    expect(WHICH_MORE_SUBMODES).toEqual(["ani-olum", "sabit-n"]);
    expect(isWhichMoreSubmode("ani-olum")).toBe(true);
    expect(isWhichMoreSubmode("sabit-n")).toBe(true);
    expect(isWhichMoreSubmode("hız-çarpanı")).toBe(false);
  });

  it("N yalnızca 5 / 10 / 15", () => {
    expect(FIXED_N_OPTIONS).toEqual([5, 10, 15]);
    for (const n of [5, 10, 15]) expect(isFixedN(n)).toBe(true);
    for (const n of [1, 3, 7, 20, 0]) expect(isFixedN(n)).toBe(false);
  });
});

describe("seri, eleme ve doğru sayısı (§12.8, BR-69)", () => {
  it("seri, ilk yanlışa kadarki doğru sayısıdır", () => {
    expect(suddenDeathStreak(answers([true, true, true, false]))).toBe(3);
    expect(suddenDeathStreak(answers([false]))).toBe(0);
    expect(suddenDeathStreak(answers([true, true, true]))).toBe(3);
  });

  it("seri, tur indeksine göre sıralar (depo sırası garanti değil)", () => {
    const unordered: readonly WhichMoreDuelAnswer[] = [
      { roundIndex: 2, chosenId: "c", correct: true },
      { roundIndex: 0, chosenId: "a", correct: true },
      { roundIndex: 1, chosenId: "b", correct: false },
    ];
    // Sıralı okununca: doğru(0), yanlış(1) → seri 1.
    expect(suddenDeathStreak(unordered)).toBe(1);
  });

  it("bir yanlış cevap eleme demektir", () => {
    expect(isEliminated(answers([true, true, false]))).toBe(true);
    expect(isEliminated(answers([true, true, true]))).toBe(false);
    expect(isEliminated(answers([]))).toBe(false);
  });

  it("doğru sayısı, eleme olmadan hepsini sayar", () => {
    expect(correctCount(answers([true, false, true, true, false]))).toBe(3);
    expect(correctCount(answers([]))).toBe(0);
  });
});

describe("Ani ölüm sonucu — kapanış kuralı (§12.8, BR-69)", () => {
  it("ikisi de canlıyken karar YOK", () => {
    const r = room(aniConfig, [
      player("a", [true, true, true]),
      player("b", [true, true]),
    ]);
    expect(whichMoreRoomResult(r).kind).toBe("devam");
  });

  it("biri s'de elendi, diğeri hâlâ ≤ s seride canlı → karar YOK", () => {
    // a, 3 seride elendi (4. yanlış). b, 3 seride canlı → s+1'e ulaşabilir.
    const r = room(aniConfig, [
      player("a", [true, true, true, false]),
      player("b", [true, true, true]),
    ]);
    expect(whichMoreRoomResult(r).kind).toBe("devam");
  });

  it("biri s'de elendi, diğeri s'yi GEÇTİ → diğeri kazandı (canlı olsa bile)", () => {
    // a, 2 seride elendi. b, 3 seride canlı (henüz elenmedi) ama 2'yi geçti.
    const r = room(aniConfig, [
      player("a", [true, true, false]),
      player("b", [true, true, true]),
    ]);
    const result = whichMoreRoomResult(r);
    expect(result).toEqual({
      kind: "galip",
      winnerId: "b",
      winnerScore: 3,
      loserScore: 2,
    });
  });

  it("ikisi de elendi, seriler farklı → yüksek olan galip", () => {
    const r = room(aniConfig, [
      player("a", [true, true, true, true, false]),
      player("b", [true, false]),
    ]);
    const result = whichMoreRoomResult(r);
    expect(result).toEqual({
      kind: "galip",
      winnerId: "a",
      winnerScore: 4,
      loserScore: 1,
    });
  });

  it("ikisi de aynı seride elendi → beraberlik", () => {
    const r = room(aniConfig, [
      player("a", [true, true, false]),
      player("b", [true, true, false]),
    ]);
    expect(whichMoreRoomResult(r)).toEqual({ kind: "beraberlik", score: 2 });
  });

  it("iki oyuncu yoksa sonuç olamaz — devam", () => {
    const r = room(aniConfig, [player("a", [true, false])]);
    expect(whichMoreRoomResult(r).kind).toBe("devam");
    expect(isWhichMoreRoomFull(r)).toBe(false);
  });
});

describe("Sabit N sonucu (§12.8, BR-69)", () => {
  it("ikisi de N'i bitirmeden karar YOK", () => {
    const r = room(fixedConfig(5), [
      player("a", [true, true, true, true, true]),
      player("b", [true, true, true]),
    ]);
    expect(whichMoreRoomResult(r).kind).toBe("devam");
  });

  it("ikisi de N'i bitirdi, doğru sayısı farklı → yüksek galip", () => {
    const r = room(fixedConfig(5), [
      player("a", [true, true, false, true, true]),
      player("b", [true, false, false, true, false]),
    ]);
    expect(whichMoreRoomResult(r)).toEqual({
      kind: "galip",
      winnerId: "a",
      winnerScore: 4,
      loserScore: 2,
    });
  });

  it("ikisi de N'i bitirdi, doğru sayısı eşit → beraberlik", () => {
    const r = room(fixedConfig(5), [
      player("a", [true, true, false, false, true]),
      player("b", [false, true, true, false, true]),
    ]);
    expect(whichMoreRoomResult(r)).toEqual({ kind: "beraberlik", score: 3 });
  });

  it("yanlış cevap rayı bitirmez — N'e kadar oynanır (eleme yok)", () => {
    // a ilk turda yanlış ama 5 turu bitirdi (4 doğru); eleme olsaydı "devam"
    // olurdu. b 3 doğru → a kazanır.
    const r = room(fixedConfig(5), [
      player("a", [false, true, true, true, true]),
      player("b", [true, true, true, false, false]),
    ]);
    expect(whichMoreRoomResult(r)).toEqual({
      kind: "galip",
      winnerId: "a",
      winnerScore: 4,
      loserScore: 3,
    });
  });
});

describe("durum ve sonuç, zamanla (§12.8, BR-60/BR-69)", () => {
  it("tek oyuncu, başlamadı → bekliyor", () => {
    const r = room(aniConfig, [player("a", [])], null);
    expect(whichMoreRoomStatus(r, KURULUS)).toBe("bekliyor");
  });

  it("iki oyuncu, kesinleşmedi, süre içinde → oynaniyor", () => {
    const r = room(aniConfig, [player("a", [true, true]), player("b", [true])]);
    expect(whichMoreRoomStatus(r, KURULUS)).toBe("oynaniyor");
  });

  it("kesinleşmiş maç → bitti (saatten önce gelir)", () => {
    const r = room(aniConfig, [
      player("a", [true, true, false]),
      player("b", [true, true, true]),
    ]);
    // Süre dolmuş olsa BİLE bitti kazanır.
    const gec = new Date(KURULUS.getTime() + ROOM_PLAY_WINDOW_MS + 1);
    expect(whichMoreRoomStatus(r, gec)).toBe("bitti");
    expect(isWhichMoreRoomDecided(r)).toBe(true);
  });

  it("kesinleşmemiş ama süresi dolmuş → suresi-doldu, sonuç yarim", () => {
    const r = room(aniConfig, [
      player("a", [true, true]),
      player("b", [true, true]),
    ]);
    const gec = new Date(KURULUS.getTime() + ROOM_PLAY_WINDOW_MS + 1);
    expect(whichMoreRoomStatus(r, gec)).toBe("suresi-doldu");
    expect(whichMoreRoomOutcome(r, gec)).toEqual({ kind: "yarim" });
  });

  it("başlamamış oda 30 dk sonra söner (katılım penceresi)", () => {
    const r = room(aniConfig, [player("a", [])], null);
    expect(whichMoreRoomDeadline(r).getTime()).toBe(
      KURULUS.getTime() + ROOM_JOIN_WINDOW_MS,
    );
  });

  it("kesinleşmiş maçın sonucu galip/beraberlik döner", () => {
    const r = room(fixedConfig(5), [
      player("a", [true, true, true, true, true]),
      player("b", [true, true, true, false, false]),
    ]);
    expect(whichMoreRoomOutcome(r, KURULUS)).toEqual({
      kind: "galip",
      winnerId: "a",
      winnerScore: 5,
      loserScore: 3,
    });
  });

  it("devam eden maç → outcome devam", () => {
    const r = room(fixedConfig(10), [
      player("a", [true, true]),
      player("b", [true]),
    ]);
    expect(whichMoreRoomOutcome(r, KURULUS)).toEqual({ kind: "devam" });
  });
});
