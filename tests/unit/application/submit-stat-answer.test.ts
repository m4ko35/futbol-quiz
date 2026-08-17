import { beforeEach, describe, expect, it } from "vitest";
import type {
  Account,
  AccountsRepository,
  SaveReportResult,
  SaveAnswerResult,
  StoredRound,
} from "@/application/ports/accounts-repository";
import type {
  StatMatchRepository,
  StatMatchTarget,
} from "@/application/ports/stat-match-repository";
import { submitStatAnswer } from "@/application/use-cases/submit-stat-answer";
import { withAnswer, type RoundAnswer } from "@/domain/services/daily-round";
import { EMPTY_ROUND } from "@/domain/services/daily-round";
import { playerId } from "@/domain/value-objects/identifiers";

/**
 * §11 BR-43/BR-44 — cevabın sunucuda tutulması.
 *
 * Sahte depolarla çalışıyor: burada ölçülen şey SQL değil, KARAR. Gerçek
 * kısıtların tuttuğu ayrıca `accounts-repository.test.ts` içinde ölçülüyor.
 */

const NOW = new Date("2026-08-16T12:00:00+03:00");
const PUZZLE_DAY = 20260816;

const TARGET: StatMatchTarget = {
  id: playerId("hedef"),
  name: "Hedef Oyuncu",
  nationality: "TR",
  stats: {
    appearances: 400,
    goals: 100,
    clubs: 5,
    nationalCaps: 50,
    heightCm: 180,
    birthYear: 1990,
  },
};

const statMatch: StatMatchRepository = {
  findDailyCandidates: () => Promise.resolve([TARGET]),
  findChosenTarget: () => Promise.resolve(TARGET),
  // Her oyuncu her istatistikte aynı değeri veriyor; puan sabit çıksın diye.
  findStatValue: () => Promise.resolve(100),
};

/** Belleğe yazan sahte hesap deposu. */
class FakeAccounts implements AccountsRepository {
  round: StoredRound | null = null;

  findBySubjectHash(): Promise<Account | null> {
    return Promise.resolve(null);
  }
  findById(): Promise<Account | null> {
    return Promise.resolve(null);
  }
  findByDisplayNameKey(): Promise<Account | null> {
    return Promise.resolve(null);
  }
  createAccount(): Promise<Account | null> {
    return Promise.resolve(null);
  }
  /** Bu testler bildirimle ilgilenmiyor; sözleşmeyi karşılamak için var. */
  saveNameReport(): Promise<SaveReportResult> {
    return Promise.resolve("yazildi");
  }
  deleteAccount(): Promise<void> {
    return Promise.resolve();
  }
  findCompletedRounds(): Promise<readonly never[]> {
    return Promise.resolve([]);
  }

  findRound(): Promise<StoredRound | null> {
    return Promise.resolve(this.round);
  }

  saveAnswer(input: {
    readonly answer: RoundAnswer;
    readonly complete: boolean;
  }): Promise<SaveAnswerResult> {
    const state = withAnswer(this.round?.state ?? EMPTY_ROUND, input.answer);

    this.round = {
      id: "r1",
      puzzleDay: PUZZLE_DAY,
      state,
      completedAt: input.complete ? NOW : null,
    };

    return Promise.resolve({ kind: "yazildi", round: this.round });
  }
}

let accounts: FakeAccounts;

beforeEach(() => {
  accounts = new FakeAccounts();
});

const submit = (
  statKey: "goals" | "clubs" | "heightCm",
  player: string,
  userId: string | null,
) =>
  submitStatAnswer(
    {
      now: NOW,
      statKey,
      playerId: playerId(player),
      userId,
    },
    { statMatch, accounts },
  );

describe("giriş YAPMAMIŞ kullanıcı", () => {
  /**
   * ANONİM OYUN KORUNUYOR: siteye ilk gelen herkesi giriş duvarıyla
   * karşılamak §11'in amacına ters düşerdi.
   */
  it("puan alır ama HİÇBİR ŞEY kaydedilmez", async () => {
    const result = await submit("goals", "p1", null);

    expect(result.score).toBeGreaterThan(0);
    expect(result.round).toBeUndefined();
    expect(accounts.round).toBeNull();
  });

  it("aynı istatistiği TEKRAR TEKRAR deneyebilir", async () => {
    await submit("goals", "p1", null);
    const ikinci = await submit("goals", "p2", null);

    expect(ikinci.round).toBeUndefined();
    expect(accounts.round).toBeNull();
  });
});

describe("giriş YAPMIŞ kullanıcı — BR-43, BR-44", () => {
  it("cevap kaydedilir ve tur özeti döner", async () => {
    const result = await submit("goals", "p1", "u1");

    expect(result.round).toEqual({
      answered: 1,
      points: result.score,
      complete: false,
    });
    expect(accounts.round?.state.answers).toHaveLength(1);
  });

  it("puan sunucuda BİRİKİR", async () => {
    const ilk = await submit("goals", "p1", "u1");
    const ikinci = await submit("clubs", "p2", "u1");

    expect(ikinci.round?.answered).toBe(2);
    expect(ikinci.round?.points).toBe(ilk.score + ikinci.score);
  });

  /** T1'İN KAPISI — ikinci deneme puanı yükseltemez. */
  it("aynı istatistiğe ikinci cevap SAKLANANI döner", async () => {
    const ilk = await submit("goals", "p1", "u1");
    const ikinci = await submit("goals", "bambaska", "u1");

    expect(ikinci.score).toBe(ilk.score);
    expect(ikinci.round?.answered).toBe(1);
    expect(accounts.round?.state.answers).toHaveLength(1);
  });

  /** BR-17 — kural artık SUNUCUDA zorlanıyor. */
  it("aynı oyuncu başka istatistikte REDDEDİLİR", async () => {
    await submit("goals", "p1", "u1");

    await expect(submit("clubs", "p1", "u1")).rejects.toThrow(/zaten/u);
    expect(accounts.round?.state.answers).toHaveLength(1);
  });

  it("hedefin KENDİSİ cevap olamaz", async () => {
    await expect(submit("goals", "hedef", "u1")).rejects.toThrow();
    expect(accounts.round).toBeNull();
  });

  /**
   * BR-24 "Sen seç" turu KAYDEDİLMEZ: herkesin çözdüğü soru değil, ve kolay
   * bir hedef seçip tam puan toplamak mümkün olurdu.
   */
  it("SEN SEÇ turu kaydedilmez", async () => {
    const result = await submitStatAnswer(
      {
        now: NOW,
        statKey: "goals",
        playerId: playerId("p1"),
        targetId: playerId("baska-hedef"),
        userId: "u1",
      },
      { statMatch, accounts },
    );

    expect(result.round).toBeUndefined();
    expect(accounts.round).toBeNull();
  });

  /** Hesap özelliği kapalıyken giriş de olamaz; yol anonime düşer. */
  it("hesap deposu YOKSA anonim gibi davranır", async () => {
    const result = await submitStatAnswer(
      {
        now: NOW,
        statKey: "goals",
        playerId: playerId("p1"),
        userId: "u1",
      },
      { statMatch, accounts: null },
    );

    expect(result.round).toBeUndefined();
  });
});
