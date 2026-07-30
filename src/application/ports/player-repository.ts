import type { PlayerSpells } from "@/domain/services/common-players";
import type { SpellFilter } from "@/domain/services/spell-filter";
import type { ClubId } from "@/domain/value-objects/identifiers";

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
}
