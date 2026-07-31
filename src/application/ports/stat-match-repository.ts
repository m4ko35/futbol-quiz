import type { StatKey } from "@/domain/services/stat-match";
import type { PlayerId } from "@/domain/value-objects/identifiers";

/**
 * İstatistik eşleştirme veri erişimi — PORT (PROJECT.md §4.1, §9.2).
 */

/** Bir oyuncunun altı istatistiği. Hepsi doludur — BR-15. */
export interface PlayerStatValues {
  readonly appearances: number;
  readonly goals: number;
  readonly clubs: number;
  readonly nationalCaps: number;
  readonly heightCm: number;
  readonly weightKg: number;
}

export interface DailyStatPlayer {
  readonly id: PlayerId;
  readonly name: string;
  readonly nationality: string | null;
  readonly stats: PlayerStatValues;
}

export interface StatMatchRepository {
  /**
   * Günün oyuncusu olabilecek adaylar — BR-15.
   *
   * SÖZLEŞME: dönen her oyuncunun altı istatistiği de doludur ve küratörlü
   * kulüplerde (§9.1) oynamıştır. Sıra KARARLI olmalıdır (kimliğe göre);
   * günün seçimi bu listeye tohumla indekslenerek yapılır ve sıranın
   * değişmesi aynı günün oyuncusunu değiştirirdi (BR-19).
   *
   * Tüm liste bir kerede döner çünkü ölçülen boyutu ~2.060 kayıt: sayfalamak
   * karmaşıklık ekler, kazandırmaz.
   */
  findDailyCandidates(): Promise<readonly DailyStatPlayer[]>;

  /**
   * Kullanıcının seçtiği oyuncunun TEK bir istatistikteki değeri — BR-16.
   *
   * `null` = o oyuncu bu istatistikte puanlanamaz. Sıfır DEĞİL: "golü yok" ile
   * "gol verisi yok" farklı şeylerdir ve ikincisi bir cevap olamaz.
   *
   * KAPSAM TUTARLILIĞI: maç, gol ve kulüp sayısı hedefte küratörlü kulüplerle
   * sınırlı sayılıyorsa cevapta da öyle sayılmalıdır. Aksi hâlde kullanıcı
   * kendi bildiği toplamla puanlanır ve puan anlamsızlaşır.
   */
  findStatValue(playerId: PlayerId, key: StatKey): Promise<number | null>;
}
