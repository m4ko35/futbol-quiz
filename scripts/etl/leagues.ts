/**
 * Hedef ligler — PROJECT.md §1.3.
 *
 * Bu QID'ler TAHMİN DEĞİL: 2026-07-28'de canlı SPARQL sorgusuyla doğrulandı.
 * Doğrulama iki hata yakaladı, ikisi de burada düzeltilmiş hâlde:
 *
 *   - Süper Lig için ilk tahmin Q170323 idi; o QID Nintendo DS'e ait.
 *   - Kulüp sorgusu tür kısıtı olmadan çalıştırıldığında dönen 9091 sonucun
 *     6066'sı insandı — P118 (lig) oyuncularda da kullanılıyor.
 *
 * Bir QID değiştirilecekse önce `npm run etl -- verify-leagues` çalıştırılıp
 * etiketin gerçekten beklenen lig olduğu görülmelidir.
 */
export interface LeagueSeed {
  readonly wikidataId: string;
  readonly name: string;
  /** ISO 3166-1 alpha-2 */
  readonly country: string;
  readonly tier: number;
  /**
   * Lig QID'inin doğruluğunu sınayan asgari kulüp sayısı (P118 üzerinden).
   * Kesin sayı tutturulmaz — kulüp evreni sezon katılımcılarıyla da
   * birleştirildiği için sayı zamanla değişir. Buradaki eşik yalnızca
   * `Q170323 = Nintendo DS` türü bir hatayı yakalamak içindir.
   */
  readonly minClubs: number;
  /**
   * Wikidata etiketi `name` ile UYUŞMUYORSA kimlik denetiminde kullanılacak
   * karşılık.
   *
   * `name` kullanıcıya gösterilen addır ve Wikidata'nın anlık etiketini takip
   * etmek ZORUNDA DEĞİLDİR: Portekiz ligi Wikidata'da sponsorlu adıyla "Liga
   * Portugal" geçiyor, Türkçe futbol dilinde ise "Primeira Liga". İkisini
   * eşitlemek ya kullanıcıya yabancı bir ad gösterirdi ya da denetimi
   * gevşetirdi.
   *
   * ALAN, DENETİMİ ZAYIFLATMAZ; yalnızca hangi dizginin aranacağını değiştirir.
   * Yanlış bir QID (Nintendo DS) her iki dizgiyle de eşleşmez.
   */
  readonly verifyLabel?: string;
}

export const TARGET_LEAGUES: readonly LeagueSeed[] = [
  {
    wikidataId: "Q9448",
    name: "Premier League",
    country: "GB",
    tier: 1,
    minClubs: 15,
  },
  {
    wikidataId: "Q324867",
    name: "La Liga",
    country: "ES",
    tier: 1,
    minClubs: 15,
  },
  {
    wikidataId: "Q15804",
    name: "Serie A",
    country: "IT",
    tier: 1,
    minClubs: 15,
  },
  {
    wikidataId: "Q82595",
    name: "Bundesliga",
    country: "DE",
    tier: 1,
    minClubs: 15,
  },
  {
    wikidataId: "Q13394",
    name: "Ligue 1",
    country: "FR",
    tier: 1,
    minClubs: 15,
  },
  {
    wikidataId: "Q485568",
    name: "Süper Lig",
    country: "TR",
    tier: 1,
    minClubs: 15,
  },
  /**
   * YAYIN ÖNCESİ GENİŞLEME (§1.3). Gerekçe belgenin kendi cümlesiydi:
   * "kullanıcı Ajax, Porto, Benfica veya Celtic arayınca hiçbir şey
   * bulamayacak". İlk üçü artık bulunuyor.
   *
   * QID'LER TAHMİN EDİLMEDİ. Hollanda ve Portekiz'in tüm futbol ligleri ülke
   * + sınıf üzerinden listelendi; ölçüm üst ligin en çok kulüp barındıran lig
   * OLMADIĞINI gösterdi (Campeonato de Portugal 61, Eredivisie 23). Ada göre
   * seçmek bu projede bir kez Nintendo DS'e gitmişti (§1.3).
   */
  {
    wikidataId: "Q167541",
    name: "Eredivisie",
    country: "NL",
    tier: 1,
    minClubs: 15,
  },
  {
    wikidataId: "Q182994",
    name: "Primeira Liga",
    country: "PT",
    tier: 1,
    minClubs: 15,
    // Wikidata sponsorlu adı taşıyor; kullanıcıya gösterilen ad değişmez.
    verifyLabel: "Liga Portugal",
  },
] as const;

/**
 * Bir kulübün seçim listesinde görünmesi için gereken en az dönem sayısı.
 *
 * Neden gerekli? `P118` (lig) tarihsel bir bağdır: Serie A'ya `Società
 * Ginnastica di Torino`, Ligue 1'e `SC Fives` ve `Olympique Lillois` gibi
 * onlarca yıl önce feshedilmiş selef kulüpler de bağlı. Bunlar seçim
 * listesinde görünürse kullanıcı boş sonuç alır. Eşik, oynanabilir kulüpleri
 * tarihsel artıklardan ayırıyor (§1.3).
 */
export const MIN_SPELLS_FOR_SELECTABLE = 50;

/**
 * Kulüp sayılan Wikidata sınıfları.
 *
 * NEDEN TEK SINIF YETMİYOR: İlk sürüm yalnızca `Q476028` (association
 * football club) kabul ediyordu ve bu **FC Barcelona'yı listeden düşürüyordu**
 * — Barcelona'nın `P31` değerleri `men's association football team`,
 * `professional sports team` ve `representation team`; hiçbiri `Q476028`
 * değil. Aynı hata Bundesliga'yı 18 yerine 17, Süper Lig'i 20 yerine 19
 * kulüple gösteriyordu.
 *
 * Liste, altı ligdeki tüm insan-olmayan `P118` bağlarının tür dağılımı
 * ölçülerek çıkarıldı. Sezon, maç, kadro listesi gibi takım olmayan türler
 * (`Q26887310`, `Q109623729`, `Q51747567`…) bilinçli olarak dışarıda.
 *
 * Geniş görünen `sports club` / `professional sports team` sınıfları sorun
 * yaratmıyor: sorgu zaten belirli bir futbol ligine (`P118`) bağlı olmayı
 * şart koşuyor, dolayısıyla başka branşlar giremiyor.
 */
export const CLUB_CLASSES: readonly string[] = [
  "Q476028", // association football club
  "Q103229495", // men's association football team
  "Q15944511", // association football team
  "Q20639856", // professional sports team
  "Q847017", // sports club
  "Q13580678", // multisports club
];

/**
 * Veri kümesi kapsamı: erkek ligleri.
 *
 * Hedeflenen altı lig erkek futbol ligleridir. Wikidata ise kadın takımı
 * dönemlerini çoğu zaman AYNI kulüp varlığına bağlar — Everton ve Liverpool
 * sorgularında kadın futbolcular erkek kulübünün kadrosundaymış gibi
 * dönüyordu. Ayrı bir kadın kulübü varlığı olmadığı için ayrım ancak oyuncu
 * düzeyinde yapılabiliyor.
 *
 * Bu bir kapsam kararıdır, bir değer yargısı değil: veri kümesi hedeflenen
 * yarışmalarla sınırlanıyor. Kadın futbolu ileride kendi lig kümesiyle ayrı
 * bir kapsam olarak eklenebilir (§10.2).
 *
 * Ölçüm (Everton + Liverpool + Galatasaray + Real Madrid, 3638 oyuncu):
 *   erkek 3599 · kadın 34 · P21 kaydı yok 5
 *
 * `P21` eksik olan kayıtlar KAPSAMDA KALIR: 5 kayıt uğruna gerçek oyuncu
 * kaybetmek, eksik meta veriyi dışlama gerekçesi saymaktan daha kötüdür.
 */
export const OUT_OF_SCOPE_GENDER_QIDS: readonly string[] = [
  "Q6581072", // female
];

/** Wikidata sınıf ve özellik kimlikleri — hepsi ölçülerek doğrulandı. */
export const WD = {
  /** P1642 (acquisition transaction) değeri: kiralık */
  VALUE_LOAN: "Q2914547",

  PROP_LEAGUE: "P118",
  PROP_MEMBER_OF_TEAM: "P54",

  /** P3450 — bir sezon varlığını bağlı olduğu lige bağlar. */
  PROP_SEASON_OF_LEAGUE: "P3450",
  /** P1923 — sezona katılan takımlar. */
  PROP_PARTICIPANT: "P1923",
  /**
   * P831 — üst kulüp. Sezona özgü takım varlıklarını (ör. `Q97905916`
   * "FC Augsburg" 2025-26) gerçek kulübe (`Q15755`) çözmek için ZORUNLU:
   * oyuncuların `P54` bağları daima ana kulüp varlığına gider, sezon
   * varlığına değil. Bu çözümleme olmadan FC Augsburg veritabanına
   * **sıfır dönem kaydıyla** giriyordu.
   */
  PROP_PARENT_CLUB: "P831",
  /**
   * P361 — parçası. `P831` ile birlikte kulüp İKİZLERİNİ bulmakta kullanılır
   * (`clubDuplicates`): şemsiye spor kulübü ile futbol takımı arasındaki bağ
   * çoğu zaman `P831` değil `P361`. Tek başına yeterli DEĞİL — aynı bağ
   * selef/halef kulüpleri de bağlıyor; ayrımı sınıf kısıtı yapar.
   */
  PROP_PART_OF: "P361",
  PROP_START_TIME: "P580",
  PROP_END_TIME: "P582",
  PROP_MATCHES_PLAYED: "P1350",
  /** Gol sayısı. DİKKAT: P6509 değil — ölçüm P1351 olduğunu gösterdi. */
  PROP_GOALS: "P1351",
  PROP_ACQUISITION: "P1642",

  /**
   * Erkek A millî futbol takımı sınıfı — PROJECT.md §9.2.
   *
   * DEĞER TAHMİN EDİLMEDİ, OKUNDU. Önce `Q6979593` ("millî futbol takımı")
   * denendi ve Buffon'un 176 maçlık İtalya kaydını HİÇ getirmedi; sonra
   * `Q23905105` denendi, o da boş döndü. Doğru sınıf, Buffon'un kendi
   * verisindeki takımın `P31` değeri okunarak bulundu.
   *
   * UYARI: bu sınıf U-21 takımlarını da kapsıyor (350 takımın 2'si) ve FIFA
   * dışı takımları da (Bask Bölgesi). Bu yüzden BR-14 "topla" değil "en
   * büyüğünü al" der.
   */
  CLASS_MENS_NATIONAL_TEAM: "Q135408445",

  /** Boy (cm) ve kütle (kg) — §9.2. */
  PROP_HEIGHT: "P2048",
  PROP_MASS: "P2067",
} as const;
