import type { Club } from "@/domain/entities/club";
import type { ClubId } from "@/domain/value-objects/identifiers";

/**
 * Kulüp veri erişimi — PORT (PROJECT.md §4.1).
 *
 * Bu arayüz `application` katmanında tanımlanır, `infrastructure` katmanında
 * uygulanır. Bağımlılık okunun tersine çevrilmesi (dependency inversion)
 * budur: iş mantığı Prisma'yı değil, Prisma bu sözleşmeyi bilir.
 *
 * Pratik sonucu: use-case testleri gerçek veritabanı olmadan, bellekteki
 * sahte bir uygulama ile çalışır ve milisaniyeler sürer.
 */

export interface ClubSearchQuery {
  /**
   * Aranan metin. `null` ise arama yapılmaz, seçilebilir kulüpler ada göre
   * sıralı döner (arayüzdeki ilk açılışta gösterilecek liste).
   */
  readonly term: string | null;

  /** Döndürülecek azami kayıt. Çağıran tarafın kelepçelemesi beklenir (§7.1). */
  readonly limit: number;
}

export interface ClubRepository {
  /** Yalnızca `isSelectable` kulüpler döner (§5.3). */
  search(query: ClubSearchQuery): Promise<Club[]>;

  /**
   * Verilen kimliklere karşılık gelen kulüpler.
   *
   * Bulunamayanlar için hata FIRLATMAZ; eksik olanlar sonuçta yer almaz.
   * "Hangisi eksikti" kararı çağırana aittir — port'un işi veri getirmek,
   * iş kuralı uygulamak değil.
   */
  findByIds(ids: readonly ClubId[]): Promise<Club[]>;

  /**
   * Wikidata QID'lerine karşılık gelen SEÇİLEBİLİR kulüpler (§9.1).
   *
   * Izgara havuzu QID ile sabitlenmiştir; kimlikler veritabanına özgü
   * (`cuid`) olduğu için her koşuda değişebilir, QID değişmez. Bulunamayan
   * QID'ler sessizce atlanır — havuzun eksiksizliğini `db:verify` denetler
   * (§8.2), çalışma zamanı değil.
   */
  findByWikidataIds(wikidataIds: readonly string[]): Promise<Club[]>;
}
