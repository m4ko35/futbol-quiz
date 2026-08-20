import { dailySeed } from "@/domain/value-objects/daily-seed";
import type { AccountsRepository } from "../ports/accounts-repository";
import type { PlayerRepository } from "../ports/player-repository";
import { withPlayerNames, type ScoredAnswerDto } from "./answer-names";

/**
 * Kullanıcının o güne ait SAKLANAN turu — PROJECT.md §11.
 *
 * NEDEN GEREKLİ. Tur artık sunucuda tutuluyor (BR-43) ama arayüz onu
 * bilmiyordu: sayfa yenilendiğinde ekran boş açılıyor, kullanıcı cevapladığı
 * istatistiği yeniden cevaplamayı deniyor ve "zaten cevapladın" hatası
 * alıyordu. Sunucu doğru sayıyor, ekran ayrı sayıyordu.
 *
 * ADLARI `answer-names.ts` ÇÖZER — aynı iş oda turunda da gerekiyor (§12.3).
 */

export interface StoredRoundDto {
  readonly answers: readonly ScoredAnswerDto[];
  readonly points: number;
  readonly complete: boolean;
}

export interface StoredRoundDeps {
  readonly accounts: AccountsRepository;
  readonly players: PlayerRepository;
}

export async function getStoredRound(
  userId: string,
  now: Date,
  deps: StoredRoundDeps,
): Promise<StoredRoundDto | null> {
  const round = await deps.accounts.findRound(userId, dailySeed(now));
  if (round === null) return null;

  const answers = await withPlayerNames(round.state.answers, deps.players);

  let points = 0;
  for (const answer of answers) points += answer.score;

  return {
    answers,
    points,
    complete: round.completedAt !== null,
  };
}
