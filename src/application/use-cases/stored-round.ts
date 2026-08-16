import type { StatKey } from "@/domain/services/stat-match";
import { dailySeed } from "@/domain/value-objects/daily-seed";
import { playerId } from "@/domain/value-objects/identifiers";
import type { AccountsRepository } from "../ports/accounts-repository";
import type { PlayerRepository } from "../ports/player-repository";

/**
 * Kullanıcının o güne ait SAKLANAN turu — PROJECT.md §11.
 *
 * NEDEN GEREKLİ. Tur artık sunucuda tutuluyor (BR-43) ama arayüz onu
 * bilmiyordu: sayfa yenilendiğinde ekran boş açılıyor, kullanıcı cevapladığı
 * istatistiği yeniden cevaplamayı deniyor ve "zaten cevapladın" hatası
 * alıyordu. Sunucu doğru sayıyor, ekran ayrı sayıyordu.
 *
 * ADLAR BURADA ÇÖZÜLÜR. Hesap veritabanı yalnızca oyuncu KİMLİĞİNİ saklar
 * (§11.3); adı da yazmak iki veritabanı arasında elle senkron tutulan bir
 * kopya yaratırdı. Çözüm gömülü veritabanından okuma olduğu için ağ turu
 * içermez (§3.1).
 */

export interface StoredAnswerDto {
  readonly statKey: StatKey;
  readonly playerId: string;
  readonly playerName: string;
  readonly value: number;
  readonly score: number;
}

export interface StoredRoundDto {
  readonly answers: readonly StoredAnswerDto[];
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

  const names = await deps.players.findNames(
    round.state.answers.map((answer) => playerId(answer.playerId)),
  );

  const answers: StoredAnswerDto[] = [];
  let points = 0;

  for (const answer of round.state.answers) {
    points += answer.score;

    answers.push({
      statKey: answer.statKey,
      playerId: answer.playerId,
      /**
       * Adı bulunamayan oyuncu ATLANMAZ, kimliğiyle gösterilir.
       *
       * Veri kümesi yenilendiğinde bir kimlik düşebilir. O cevabı gizlemek,
       * kullanıcının cevapladığı istatistiği boş göstermek ve onu tekrar
       * denemeye itmek olurdu — oysa sunucu o istatistiği kapalı sayıyor.
       */
      playerName: names.get(answer.playerId) ?? answer.playerId,
      value: answer.value,
      score: answer.score,
    });
  }

  return {
    answers,
    points,
    complete: round.completedAt !== null,
  };
}
