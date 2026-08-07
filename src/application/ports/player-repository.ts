import type { Player } from "@/domain/entities/player";
import type { PlayerSpells } from "@/domain/services/common-players";
import type { GridCriterion } from "@/domain/services/grid";
import type { SpellFilter } from "@/domain/services/spell-filter";
import type { StatKey } from "@/domain/services/stat-match";
import type { ClubId, PlayerId } from "@/domain/value-objects/identifiers";

/**
 * Oyuncu veri erişimi — PORT (PROJECT.md §4.1).
 */

export interface CommonPlayersQuery {
  readonly clubA: ClubId;
  readonly clubB: ClubId;
  readonly filter: SpellFilter;
}

export interface PlayerRepository {
  /**
   * İki kulüpte de nitelikli dönemi olan oyuncular ve BU İKİ KULÜPTEKİ
   * nitelikli dönemleri.
   *
   * SÖZLEŞME — uygulayan taraf bunları garanti eder:
   *   1. Dönen her oyuncunun `clubA`'da ≥1 ve `clubB`'de ≥1 dönemi vardır.
   *   2. `spells` yalnızca bu iki kulübün dönemlerini içerir.
   *   3. `spells` yalnızca `filter`'dan geçen dönemleri içerir; eleme ölçütü
   *      `spellQualifies` ile birebir aynıdır.
   *   4. Aynı oyuncu birden çok kez dönmez.
   *
   * 3. madde bu sözleşmenin kırılgan yeridir: kural bir kez TypeScript'te
   * (`spellQualifies`), bir kez SQL'de yazılır. İkisinin ayrışmadığı
   * entegrasyon testiyle ölçülür — yorumla değil.
   *
   * Filtreleme neden port'a itiliyor? Ortak oyuncu sorgusu 193 bin dönem
   * satırı üzerinde çalışır; elemeyi veritabanına bırakmak p95 < 150 ms
   * hedefinin (§1.4) ön koşuludur.
   */
  findCommonPlayers(query: CommonPlayersQuery): Promise<PlayerSpells[]>;

  /**
   * Bir ızgara kriterini sağlayan TÜM oyuncu kimlikleri (§9.1).
   *
   * Küme olarak dönmesinin sebebi üretim algoritmasıdır: dokuz hücrenin
   * kesişimi bellekte hesaplanır. Her hücre için ayrı sorgu atmak, ızgara
   * denemesi başına 9 gidiş-dönüş demekti; ortak oyuncu sorgusunda aynı
   * tercih ölçülerek doğrulanmıştı (p95 47,7 → 16,8 ms).
   *
   * BR-2 burada da geçerlidir: altyapı dönemleri sayılmaz.
   */
  findIdsMatching(criterion: GridCriterion): Promise<PlayerId[]>;

  /**
   * Verilen oyuncu, verilen kriterlerin HEPSİNİ sağlıyor mu? (BR-12)
   *
   * Cevap doğrulaması bu tek çağrıyla yapılır. `findIdsMatching` ile küme
   * çekip üyelik denetlemek de mümkündü ama bir cevabı doğrulamak için
   * binlerce kimlik taşımak gereksiz.
   */
  matchesAll(
    playerId: PlayerId,
    criteria: readonly GridCriterion[],
  ): Promise<boolean>;

  /**
   * Oyuncu adı araması — ızgarada cevap seçmek için (BR-12).
   *
   * Kullanıcı ad YAZMAZ, listeden SEÇER; doğrulama kimlik üzerinden yapılır.
   * Ada göre eşleştirme bu projede dört kez yanılttı (§10.1).
   */
  search(query: PlayerSearchQuery): Promise<Player[]>;
}

export interface PlayerSearchQuery {
  readonly term: string;
  /** Çağıran tarafın kelepçelemesi beklenir (§7.1). */
  readonly limit: number;
  /**
   * Verilirse sonuç, o istatistikte PUANLANABİLİR oyuncularla sınırlanır
   * (§9.2, BR-16).
   *
   * NEDEN GEREKLİ, ölçüldü: arama alfabetik sırayla dönüyor ve "Buffon"
   * araması önce hiç verisi olmayan "Armando Buffon"u getiriyordu. Kullanıcı
   * onu seçiyor, sunucu haklı olarak reddediyor ve oyun bir duvara dönüşüyordu.
   * Süzgeç, BR-16'nın tanımladığı havuzu seçicide GÖRÜNÜR kılar.
   */
  readonly scoreableFor?: StatKey;
  /**
   * `true` → sonuç yalnızca "Sen seç" turuna HEDEF olabilecek oyuncularla
   * sınırlanır (§9.2, BR-24).
   *
   * NEDEN GEREKLİ, ölçüldü: süzgeçsiz seçicide ilk 20 sonucun yalnızca
   * %18–50'si geçerli hedefti — "buffon" aramasında 5 sonuçtan 1'i, "kaka"da
   * 11'de 2'si. Kullanıcı çoğu seçiminde reddedilirdi; bu, `scoreableFor`'un
   * kaldırmak için eklendiği duvarın aynısı.
   */
  readonly targetable?: boolean;
}
