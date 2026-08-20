import type { RoundAnswer } from "@/domain/services/daily-round";
import type { StatKey } from "@/domain/services/stat-match";
import { playerId } from "@/domain/value-objects/identifiers";
import type { PlayerRepository } from "../ports/player-repository";

/**
 * Puanlanmış bir cevabın adı çözülmüş hâli — PROJECT.md §11.3, §12.3.
 *
 * ADLAR NEDEN SAKLANMIYOR. Hesap veritabanı yalnızca oyuncu KİMLİĞİNİ tutar;
 * adı da yazmak iki veritabanı arasında elle senkron tutulan bir kopya
 * yaratırdı ve veri kümesi yenilendiğinde sessizce eskirdi. Çözüm gömülü
 * veritabanından okunuyor, yani ağ turu yok (§3.1).
 *
 * NEDEN AYRI DOSYA. Aynı çözüm iki yerde gerekiyor: günlük saklanan tur
 * (§11) ve oda turu (§12). İkisi de kimlik listesi taşıyor, ikisi de aynı
 * yedek kuralına muhtaç. Kopyalansaydı ayrışırdı — ve ayrışacağı yer tam da
 * aşağıdaki yedek kuralı olurdu, yani kullanıcının ekranından bir cevabın
 * kaybolduğu yer.
 */

export interface ScoredAnswerDto {
  readonly statKey: StatKey;
  readonly playerId: string;
  readonly playerName: string;
  readonly value: number;
  readonly score: number;
}

export async function withPlayerNames(
  answers: readonly RoundAnswer[],
  players: PlayerRepository,
): Promise<ScoredAnswerDto[]> {
  // Boş turda sorgu YOK: oda lobisinde her yoklama bu yoldan geçiyor ve
  // henüz tek cevap bile yazılmamış oluyor.
  if (answers.length === 0) return [];

  const names = await players.findNames(
    answers.map((answer) => playerId(answer.playerId)),
  );

  return answers.map((answer) => ({
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
  }));
}
