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
  readonly birthYear: number;
}

/**
 * Bir turun HEDEFİ.
 *
 * Adı "günün oyuncusu" DEĞİL: aynı şekli iki giriş üretiyor — gün tohumundan
 * seçilen oyuncu (BR-19) ve kullanıcının kendi seçtiği oyuncu (BR-24). Tip
 * "daily" diye adlandırılsaydı ikinci girişte adı yalan söylerdi.
 */
export interface StatMatchTarget {
  readonly id: PlayerId;
  readonly name: string;
  readonly nationality: string | null;
  readonly stats: PlayerStatValues;
}

export interface StatMatchRepository {
  /**
   * Günün oyuncusu olabilecek adaylar — BR-15, BR-23.
   *
   * SÖZLEŞME: dönen her oyuncunun altı istatistiği de doludur ve küratörlü
   * kulüplerde (§9.1) TANINIRLIK eşiğini geçmiştir. Sıra KARARLI olmalıdır
   * (kimliğe göre); günün seçimi bu listeye tohumla indekslenerek yapılır ve
   * sıranın değişmesi aynı günün oyuncusunu değiştirirdi (BR-19).
   *
   * BR-23 — küratörlü liste yalnızca UYGUNLUĞU süzer. Dönen `stats`
   * değerleri §1.3 kapsamındaki TÜM kulüpleri sayar; ikisini birleştirmek
   * kapsam bildirimini üç lig turu boyunca yanlış tutmuştu (§9.2).
   *
   * Tüm liste bir kerede döner çünkü ölçülen boyutu ~1.927 kayıt: sayfalamak
   * karmaşıklık ekler, kazandırmaz.
   */
  findDailyCandidates(): Promise<readonly StatMatchTarget[]>;

  /**
   * Kullanıcının HEDEF olarak seçtiği oyuncu — BR-24.
   *
   * `null` = bu oyuncu hedef olamaz (altı istatistiğinden biri eksik ya da
   * puanın anlamlı olması için gereken 100 maç / 2 kulüp eşiğini geçmiyor).
   * Sessizce başka bir oyuncuya kaydırılmaz; çağıran tarafın reddi kullanıcıya
   * SÖYLEMESİ gerekir.
   *
   * Tanınırlık süzgeci burada UYGULANMAZ: seçen kullanıcı, kimi seçtiğini
   * zaten biliyor (§9.2).
   */
  findChosenTarget(playerId: PlayerId): Promise<StatMatchTarget | null>;

  /**
   * Kullanıcının cevap olarak seçtiği oyuncunun TEK bir istatistikteki
   * değeri — BR-16.
   *
   * `null` = o oyuncu bu istatistikte puanlanamaz. Sıfır DEĞİL: "golü yok" ile
   * "gol verisi yok" farklı şeylerdir ve ikincisi bir cevap olamaz.
   *
   * KAPSAM TUTARLILIĞI: hedef 24 ligi sayıyorsa cevap da saymalıdır (BR-23).
   * Aksi hâlde iki taraf farklı ölçekte karşılaştırılır ve puan anlamsızlaşır.
   */
  findStatValue(playerId: PlayerId, key: StatKey): Promise<number | null>;
}
