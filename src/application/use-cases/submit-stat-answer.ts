import { ValidationError } from "@/domain/errors/domain-error";
import {
  EMPTY_ROUND,
  isRoundFinished,
  judgeSubmission,
  roundPoints,
  withAnswer,
  type RoundAnswer,
  type RoundRejection,
  type RoundState,
} from "@/domain/services/daily-round";
import type { StatKey } from "@/domain/services/stat-match";
import { dailySeed } from "@/domain/value-objects/daily-seed";
import type { PlayerId } from "@/domain/value-objects/identifiers";
import type { AccountsRepository } from "../ports/accounts-repository";
import type { StatMatchRepository } from "../ports/stat-match-repository";
import {
  checkStatAnswer,
  getDailyStatMatch,
  type CheckStatAnswerDto,
} from "./daily-stat-match";

/**
 * Bir istatistik cevabının gönderilmesi — PROJECT.md §11, BR-43/BR-44/BR-45.
 *
 * İKİ YOL, TEK UÇ:
 *
 *   giriş YOK      → eski davranış: sunucu puanlar, hiçbir yere yazmaz
 *   giriş VAR      → tur SUNUCUDA tutulur; tek deneme, sunucu toplamı
 *
 * ANONİM OYUN KORUNUYOR ve bu bir ürün kararı: siteye ilk gelen herkesi bir
 * giriş duvarıyla karşılamak, §11'in amacına (ziyaretçiyi geri getirmek) ters
 * düşerdi. Giriş yapmayan oynar, yalnızca lider tablosuna girmez.
 */

export interface RoundSummaryDto {
  /** Kaç istatistik cevaplandı. */
  readonly answered: number;
  /** BR-44 — sunucuda biriken toplam, 0–600. */
  readonly points: number;
  /** BR-45 — altı istatistik de cevaplandı mı? */
  readonly complete: boolean;
}

export interface SubmitStatAnswerDto extends CheckStatAnswerDto {
  /**
   * Turun sunucudaki durumu — YALNIZCA giriş yapmış kullanıcının GÜNLÜK
   * turunda vardır. Yokluğu "kaydedilmedi" demektir ve arayüz bunu
   * kullanıcıya söyleyebilmelidir.
   */
  readonly round?: RoundSummaryDto;
}

export interface SubmitStatAnswerInput {
  readonly now: Date;
  readonly statKey: StatKey;
  readonly playerId: PlayerId;
  /** BR-24 "Sen seç" turu — varsa tur KAYDEDİLMEZ (aşağıda gerekçesi). */
  readonly targetId?: PlayerId;
  /**
   * Oturum sahibinin kimliği; giriş yoksa `null`.
   *
   * SUNUCUDAN GELİR, İSTEMCİDEN DEĞİL. Girdi şemasında olsaydı istemci
   * başkasının kimliğini gönderip onun turuna yazardı.
   */
  readonly userId: string | null;
}

export interface SubmitStatAnswerDeps {
  readonly statMatch: StatMatchRepository;
  /** Hesap özelliği kapalıysa `null` — anonim yol yine çalışır. */
  readonly accounts: AccountsRepository | null;
}

/** Reddin kullanıcıya gösterilecek gerekçesi. */
function rejectionMessage(reason: RoundRejection): string {
  switch (reason) {
    case "oyuncu-kullanildi":
      return "Bu oyuncuyu bu turda zaten kullandın; her istatistik için farklı bir isim gerekiyor.";
    case "hedef-secilemez":
      return "Hedef oyuncu cevap olarak seçilemez.";
  }
}

function summarize(state: RoundState): RoundSummaryDto {
  return {
    answered: state.answers.length,
    points: roundPoints(state),
    complete: isRoundFinished(state),
  };
}

export async function submitStatAnswer(
  input: SubmitStatAnswerInput,
  deps: SubmitStatAnswerDeps,
): Promise<SubmitStatAnswerDto> {
  /**
   * TUR YALNIZCA GÜNLÜK BULMACADA KAYDEDİLİR.
   *
   * `targetId` varsa kullanıcı hedefi kendisi seçmiştir (BR-24) ve o tur
   * herkesin çözdüğü soru değildir; lider tablosuna girmesi BR-11'in "herkes
   * aynı soruyu çözer" güvencesini bozardı. Kolay bir hedef seçip tam puan
   * toplamak da mümkün olurdu.
   */
  const recordable =
    input.userId !== null &&
    input.targetId === undefined &&
    deps.accounts !== null;

  if (!recordable) {
    return checkStatAnswer(
      {
        now: input.now,
        statKey: input.statKey,
        playerId: input.playerId,
        ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
      },
      deps,
    );
  }

  // `recordable` daraltmayı tip düzeyinde taşımıyor; ikisi de burada kesin.
  const accounts = deps.accounts;
  const userId = input.userId;
  if (accounts === null || userId === null) {
    throw new Error("Kaydedilebilir tur için hesap deposu gerekli (§11).");
  }

  const puzzleDay = dailySeed(input.now);
  const stored = await accounts.findRound(userId, puzzleDay);
  const state = stored?.state ?? EMPTY_ROUND;

  /**
   * Hedef, gün tohumundan çözülüyor — BR-19.
   *
   * FAZLADAN SORGU DEĞİL: `getDailyStatMatch` günün oyuncusunu bellekte
   * tutuyor (aynı gün ilk istek öder, sonrakiler ödemez). Hedefin kimliği
   * burada gerekiyor çünkü BR-17'nin kardeşi olan "hedefin kendisi cevap
   * olamaz" kuralı da tur kararının parçası.
   */
  const daily = await getDailyStatMatch(input.now, deps);

  const verdict = judgeSubmission({
    state,
    statKey: input.statKey,
    playerId: input.playerId,
    targetId: daily.player.id,
  });

  if (verdict.kind === "tekrar") {
    return {
      value: verdict.answer.value,
      score: verdict.answer.score,
      round: summarize(state),
    };
  }

  if (verdict.kind === "ret") {
    throw new ValidationError(rejectionMessage(verdict.reason));
  }

  // Puanlama BR-20'nin yolundan geçiyor: hedef sunucuda yeniden çözülüyor ve
  // BR-16 (verisi olmayan oyuncu) burada reddediliyor.
  const scored = await checkStatAnswer(
    { now: input.now, statKey: input.statKey, playerId: input.playerId },
    deps,
  );

  const answer: RoundAnswer = {
    statKey: input.statKey,
    playerId: input.playerId,
    value: scored.value,
    score: scored.score,
  };

  const complete = isRoundFinished(withAnswer(state, answer));

  const saved = await accounts.saveAnswer({
    userId,
    puzzleDay,
    answer,
    complete,
  });

  /**
   * YARIŞI KAYBETTİK: eşzamanlı ikinci istek önce yazmış. BR-43 gereği
   * saklanan cevap dönüyor — kendi hesapladığımız puan DEĞİL.
   */
  if (saved.kind === "zaten-var") {
    const existing = saved.round.state.answers.find(
      (a) => a.statKey === input.statKey,
    );

    if (existing !== undefined) {
      return {
        value: existing.value,
        score: existing.score,
        round: summarize(saved.round.state),
      };
    }
  }

  return {
    value: scored.value,
    score: scored.score,
    round: summarize(saved.round.state),
  };
}
