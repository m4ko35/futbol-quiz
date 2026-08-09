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

  /**
   * Lig süzgeci — BR-37. `null` ise bütün liglerde aranır.
   *
   * DEĞERİ QID'DİR, veritabanı kimliği değil. Kimlikler (`cuid`) her ETL
   * koşusunda değişir; bir süzgeç değeri adres çubuğuna ya da paylaşılan bir
   * bağlantıya girebildiği için koşudan koşuya sabit kalmak zorunda (§9.1'in
   * ızgara havuzunu QID ile sabitlemesiyle aynı gerekçe).
   *
   * Tanınmayan QID hata DEĞİL, boş sonuçtur: port'un işi veri getirmek, geçerli
   * kimlik denetimi yapmak değil (`findByIds` ile aynı sözleşme).
   */
  readonly leagueWikidataId: string | null;
}

export interface ClubRepository {
  /** Yalnızca `isSelectable` kulüpler döner (§5.3). */
  search(query: ClubSearchQuery): Promise<Club[]>;

  /**
   * Gözatılabilir lig künyeleri — BR-37, §7.14.
   *
   * SÖZLEŞME: yalnızca SEÇİLEBİLİR kulübü olan ligler döner ve `clubCount`
   * yalnızca seçilebilir kulüpleri sayar. Kullanıcı listede başka bir kulüp
   * göremediği için başka bir sayı göstermek yanlış beklenti kurardı — "41"
   * yazıp 32 kulüp göstermek, eksikliği veri kusuru gibi okutur.
   *
   * Ada göre sıralı döner; liste kullanıcıya olduğu gibi basılır.
   */
  listLeagues(): Promise<readonly LeagueSummary[]>;

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

  /**
   * Arma atıf künyeleri — PROJECT.md §7.3, BR-34.
   *
   * SÖZLEŞME: yalnızca arması OLAN ve lisans künyesi TAM olan kulüpler döner.
   * Künyesi eksik bir kulübün burada görünmemesi bir gizleme değil, kuralın
   * kendisi: BR-34 gereği künyesi eksik arma zaten gösterilmez.
   *
   * Kulüp adına göre sıralı döner — sayfa alfabetik okunacak.
   */
  listCrestCredits(): Promise<readonly CrestCredit[]>;
}

/** Bir armanın atıf künyesi (§7.3). */
export interface CrestCredit {
  readonly clubName: string;
  readonly license: string;
  /** Kamu malı dosyalarda yazar anılmak zorunda değil. */
  readonly author: string | null;
  readonly filePage: string;
}

/** Gözatma listesindeki bir lig (§7.14). */
export interface LeagueSummary {
  /** Kararlı kimlik — süzgeç bu değerle çalışır. */
  readonly wikidataId: string;
  readonly name: string;
  /** ISO 3166-1 alpha-2. */
  readonly country: string;
  /** Ligdeki SEÇİLEBİLİR kulüp sayısı. */
  readonly clubCount: number;
}
