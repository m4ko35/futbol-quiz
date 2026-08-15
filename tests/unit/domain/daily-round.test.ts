import { describe, expect, it } from "vitest";
import {
  answerFor,
  answeredCount,
  EMPTY_ROUND,
  isPlayerUsed,
  isRoundFinished,
  judgeSubmission,
  leaderboardPoints,
  MAX_ROUND_POINTS,
  remainingStats,
  roundPercent,
  roundPoints,
  withAnswer,
  type RoundAnswer,
  type RoundState,
} from "@/domain/services/daily-round";
import { STAT_KEYS } from "@/domain/services/stat-match";

/**
 * §11 BR-43/BR-44/BR-45 — turun SUNUCUDAKİ durumu.
 *
 * Buradaki kuralların hepsi lider tablosunun anlamlı olması için var; hiçbiri
 * bir görünüm tercihi değil.
 */

const TARGET = "hedef";

const answer = (
  statKey: RoundAnswer["statKey"],
  playerId: string,
  score: number,
): RoundAnswer => ({ statKey, playerId, value: 1, score });

const roundWith = (...answers: readonly RoundAnswer[]): RoundState =>
  answers.reduce(withAnswer, EMPTY_ROUND);

/** Altı istatistiğin hepsi cevaplanmış bir tur. */
const fullRound = (scores: readonly number[]): RoundState =>
  STAT_KEYS.reduce(
    (state, key, index) =>
      withAnswer(state, answer(key, `p${index}`, scores[index] ?? 0)),
    EMPTY_ROUND,
  );

describe("judgeSubmission — BR-43 tek deneme", () => {
  it("boş turda puanlamaya izin verir", () => {
    const verdict = judgeSubmission({
      state: EMPTY_ROUND,
      statKey: "goals",
      playerId: "p1",
      targetId: TARGET,
    });

    expect(verdict.kind).toBe("puanla");
  });

  it("cevaplanmış istatistikte SAKLANAN cevabı döner, yeniden puanlamaz", () => {
    const stored = answer("goals", "p1", 42);
    const verdict = judgeSubmission({
      state: roundWith(stored),
      statKey: "goals",
      playerId: "p2",
      targetId: TARGET,
    });

    expect(verdict).toEqual({ kind: "tekrar", answer: stored });
  });

  /**
   * T1'İN TA KENDİSİ. Kural olmadan kullanıcı aynı istatistiğe onlarca oyuncu
   * deneyip en iyisini saklayabilirdi; tablo o zaman bilgiyi değil sabrı
   * ölçer.
   */
  it("ikinci deneme puanı YÜKSELTEMEZ", () => {
    const stored = answer("goals", "p1", 10);
    const verdict = judgeSubmission({
      state: roundWith(stored),
      statKey: "goals",
      playerId: "mukemmel-oyuncu",
      targetId: TARGET,
    });

    expect(verdict.kind === "tekrar" && verdict.answer.score).toBe(10);
  });

  /**
   * SIRA ÖNEMLİ. İstemci yanıtı alamayıp AYNI isteği yeniden gönderdiğinde,
   * "bu oyuncuyu zaten kullandın" demek yanlış olurdu — o oyuncuyu kullanan
   * şey isteğin kendisi. Doğru cevap saklanan cevabı geri vermek.
   */
  it("ağ tekrarı: aynı istek yeniden gelirse saklanan cevap döner", () => {
    const stored = answer("goals", "p1", 42);
    const verdict = judgeSubmission({
      state: roundWith(stored),
      statKey: "goals",
      playerId: "p1",
      targetId: TARGET,
    });

    expect(verdict).toEqual({ kind: "tekrar", answer: stored });
  });
});

describe("judgeSubmission — BR-17 bir oyuncu bir kez", () => {
  it("başka istatistikte kullanılmış oyuncuyu reddeder", () => {
    const verdict = judgeSubmission({
      state: roundWith(answer("goals", "p1", 50)),
      statKey: "clubs",
      playerId: "p1",
      targetId: TARGET,
    });

    expect(verdict).toEqual({ kind: "ret", reason: "oyuncu-kullanildi" });
  });

  it("kullanılmamış oyuncuya izin verir", () => {
    const verdict = judgeSubmission({
      state: roundWith(answer("goals", "p1", 50)),
      statKey: "clubs",
      playerId: "p2",
      targetId: TARGET,
    });

    expect(verdict.kind).toBe("puanla");
  });

  it("hedefin kendisi cevap olamaz", () => {
    const verdict = judgeSubmission({
      state: EMPTY_ROUND,
      statKey: "goals",
      playerId: TARGET,
      targetId: TARGET,
    });

    expect(verdict).toEqual({ kind: "ret", reason: "hedef-secilemez" });
  });

  it("isPlayerUsed turun tamamına bakar", () => {
    const state = roundWith(answer("goals", "p1", 1), answer("clubs", "p2", 1));

    expect(isPlayerUsed(state, "p2")).toBe(true);
    expect(isPlayerUsed(state, "p3")).toBe(false);
  });
});

describe("withAnswer", () => {
  it("girdiyi DEĞİŞTİRMEZ", () => {
    const before = roundWith(answer("goals", "p1", 10));
    const after = withAnswer(before, answer("clubs", "p2", 20));

    expect(answeredCount(before)).toBe(1);
    expect(answeredCount(after)).toBe(2);
  });

  it("sırayı korur", () => {
    const state = roundWith(
      answer("clubs", "p1", 1),
      answer("goals", "p2", 1),
      answer("heightCm", "p3", 1),
    );

    expect(state.answers.map((a) => a.statKey)).toEqual([
      "clubs",
      "goals",
      "heightCm",
    ]);
  });

  /**
   * Sessizce üzerine yazmak BR-43'ün tek denemesini kaybettirir ve hiçbir
   * yerde iz bırakmaz; çağıran `judgeSubmission` ile geçmek zorunda.
   */
  it("aynı istatistiğe ikinci yazma PATLAR", () => {
    const state = roundWith(answer("goals", "p1", 10));

    expect(() => withAnswer(state, answer("goals", "p2", 90))).toThrow(/BR-43/);
  });

  it("answerFor saklanan cevabı bulur", () => {
    const state = roundWith(answer("goals", "p1", 10));

    expect(answerFor(state, "goals")?.playerId).toBe("p1");
    expect(answerFor(state, "clubs")).toBeUndefined();
  });
});

describe("tur ilerlemesi", () => {
  it("boş tur bitmiş sayılmaz ve altı istatistik kalır", () => {
    expect(isRoundFinished(EMPTY_ROUND)).toBe(false);
    expect(remainingStats(EMPTY_ROUND)).toEqual([...STAT_KEYS]);
  });

  it("beş cevap YETMEZ", () => {
    const state = STAT_KEYS.slice(0, 5).reduce(
      (acc, key, index) => withAnswer(acc, answer(key, `p${index}`, 100)),
      EMPTY_ROUND,
    );

    expect(isRoundFinished(state)).toBe(false);
    expect(remainingStats(state)).toHaveLength(1);
  });

  it("altı cevapla tur biter", () => {
    const state = fullRound([100, 100, 100, 100, 100, 100]);

    expect(isRoundFinished(state)).toBe(true);
    expect(remainingStats(state)).toEqual([]);
  });

  it("remainingStats sunum sırasını korur", () => {
    const [, ikinci] = STAT_KEYS;
    const state = roundWith(answer(ikinci, "p1", 1));

    expect(remainingStats(state)).toEqual(
      STAT_KEYS.filter((key) => key !== ikinci),
    );
  });
});

describe("roundPoints — BR-44", () => {
  it("boş tur sıfır puan", () => {
    expect(roundPoints(EMPTY_ROUND)).toBe(0);
  });

  it("puanları toplar", () => {
    expect(roundPoints(fullRound([10, 20, 30, 40, 50, 60]))).toBe(210);
  });

  it("tam turun üst sınırı MAX_ROUND_POINTS", () => {
    expect(roundPoints(fullRound([100, 100, 100, 100, 100, 100]))).toBe(
      MAX_ROUND_POINTS,
    );
    expect(MAX_ROUND_POINTS).toBe(600);
  });

  /**
   * TOPLAM SAKLANMASININ SEBEBİ. Ortalama yuvarlanır ve sıralamada GERÇEK fark
   * taşıyan iki turu eşit gösterir; toplam göstermez.
   */
  it("ortalamanın eşit gösterdiği iki turu toplam AYIRIR", () => {
    const dusuk = fullRound([68, 68, 68, 68, 68, 67]); // 407 → %67,83
    const yuksek = fullRound([69, 68, 68, 68, 68, 68]); // 409 → %68,17

    expect(roundPercent(dusuk)).toBe(roundPercent(yuksek));
    expect(roundPoints(dusuk)).toBeLessThan(roundPoints(yuksek));
  });

  it("roundPercent oyunun gösterdiği sayıyı verir", () => {
    expect(roundPercent(fullRound([100, 100, 100, 0, 0, 0]))).toBe(50);
    expect(roundPercent(EMPTY_ROUND)).toBe(0);
  });

  it("roundPercent yarım turda cevaplananların ortalamasıdır", () => {
    const state = roundWith(
      answer("goals", "p1", 80),
      answer("clubs", "p2", 60),
    );

    expect(roundPercent(state)).toBe(70);
  });
});

describe("leaderboardPoints — BR-45", () => {
  it("tamamlanmış tur puanını verir", () => {
    expect(leaderboardPoints(fullRound([10, 20, 30, 40, 50, 60]))).toBe(210);
  });

  /**
   * Yarım turu 0 saymak YANLIŞ olurdu: kullanıcı kötü oynadığı için değil,
   * bitirmediği için listede yok. İkisi farklı şeyler.
   */
  it("yarım tur null döner — 0 DEĞİL", () => {
    const state = roundWith(answer("goals", "p1", 100));

    expect(leaderboardPoints(state)).toBeNull();
    expect(roundPoints(state)).toBe(100);
  });

  it("boş tur da null", () => {
    expect(leaderboardPoints(EMPTY_ROUND)).toBeNull();
  });

  it("hepsi 0 puanlı TAM tur 0 döner — null değil", () => {
    // Bitirmiş ama hiç isabet edememiş kullanıcı listede GÖRÜNÜR.
    expect(leaderboardPoints(fullRound([0, 0, 0, 0, 0, 0]))).toBe(0);
  });
});
