/**
 * İstatistik eşleştirme modu — PROJECT.md §9.2.
 *
 * Bu dosya saf kuraldır: veri erişimi, rastgelelik kaynağı ve sunum burada
 * YOKTUR (§2.1).
 */

/**
 * Oyunda sorulan istatistikler.
 *
 * Anahtarlar API sözleşmesinin parçasıdır (§6.5) ve değiştirilemez; etiketler
 * sunum tarafındadır ve serbestçe değişebilir.
 */
export const STAT_KEYS = [
  "appearances",
  "goals",
  "clubs",
  "nationalCaps",
  "heightCm",
  "birthYear",
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

export function isStatKey(value: string): value is StatKey {
  return (STAT_KEYS as readonly string[]).includes(value);
}

/**
 * Bir istatistiğin havuzdaki standart sapması — BR-18'in paydası.
 *
 * NEDEN SABİT, VERİDEN HESAPLANMIYOR: puanlama kuralı her istek için tüm
 * havuzu taramamalı ve aynı cevap farklı günlerde farklı puan almamalı.
 * Değerler ölçülerek konur; veri kümesi yenilendiğinde ölçüm TEKRARLANIR —
 * `npm run stats:measure` farkı %15'i aşarsa "BAYAT" diye işaretler.
 *
 * ÖLÇÜM — BR-15 aday havuzunun tamamı, **1.766 oyuncu** (22 Ağustos 2026):
 *
 *                 min   p25  medyan  p75   p95   max      SD
 *   resmî maç      18   430    539   668   857  1374   175,8
 *   resmî gol       0    22     57   137   299   755    98,0
 *   kulüp sayısı    2     4      5     7    10    15     2,2
 *   A millî maç     0    14     39    72   118   180    37,5
 *   boy           160   177    182   186   193   203     6,6
 *   doğum yılı   1874  1976   1985  1992  1998  2005    14,0
 *
 * ÜÇ SABİT BİRDEN DEĞİŞTİ ve sebebi tek: BR-23 (§9.2). Maç ile gol artık 24
 * ligi değil kariyerin tamamını sayıyor, yani ölçekleri büyüdü — maç
 * 120,3 → 175,8, gol 60,5 → 98,0. Doğum yılı ise SAYILARI değişmediği hâlde
 * saptı (19,8 → 14,0): havuz değişti. Kariyer toplamı Vikipedi'nin kariyer
 * tablosundan geliyor ve o tablo çoğunlukla modern oyuncularda dolu, yani
 * aday havuzu 2.662'den 1.766'ya inerken yaş yayılımı da daraldı (en eski
 * 1861 → 1874, çeyrekler 1965/1987 → 1976/1992).
 *
 * ÜÇÜNCÜSÜ ÖNEMLİ BİR DERSTİR: bir istatistiğin sapması, o istatistiğe hiç
 * dokunulmadan da bayatlayabilir. Havuzun tanımı değiştiyse hepsi yeniden
 * ölçülür.
 *
 * BİR ÖNCEKİ BAYATLAMA da bu satırların var olma sebebiydi: lig kapsamı
 * 6'dan 24'e çıkınca `clubs` sapması 1,2 → 2,2 olmuş ve kimse fark etmemişti,
 * çünkü ölçümü tekrarlayacak bir araç yoktu.
 *
 * ONDALIKLAR KORUNDU. `clubs` sapması tam sayıya yuvarlansa 2'ye inerdi; iki
 * kulüplük bir sapmanın puanı %50'den %55'e kayardı. Altı istatistiğin en dar
 * ölçeklisinde bu fark oyunun tamamını etkiliyor.
 */
export const STAT_DEVIATIONS: Readonly<Record<StatKey, number>> = {
  appearances: 175.8,
  goals: 98.0,
  clubs: 2.2,
  nationalCaps: 37.5,
  heightCm: 6.6,
  birthYear: 14.0,
};

/**
 * BR-18 — puan, farkı istatistiğin KENDİ yayılımına bölerek hesaplanır.
 *
 * NEDEN ORANSAL DEĞİL. Ham oransal fark (`|fark| / hedef`) iki uçta birden
 * bozuluyor, ölçüldü:
 *
 *   400 maç hedefte 300 tahmin  → oransal %75  (100 maç sapmaya fazla cömert)
 *     3 gol hedefte   8 tahmin  → oransal  %0  (5 gol sapmaya acımasız)
 *
 * Yayılıma bölünce aynı iki senaryo %53 ve %89 veriyor — ikisi de o
 * istatistikteki gerçek büyüklüğe göre doğru. Formül ölçekten bağımsızdır:
 * boy ile gol sayısı aynı kuralla puanlanabilir.
 *
 * ÇARPAN NEDEN 2. Çarpan 1 (yalın standart sapma) yukarıdaki ilk senaryoya %6
 * verir — matematiksel olarak savunulabilir ama bir tahmin oyunu için fazla
 * sert: kimse 400 maçlık bir kariyeri 20 maç hatayla bilemez. Çarpan 2 ile
 * 1 birim sapma ≈ %99, yarım sd ≈ %75, 2 sd ≈ %0. Bu bir ÜRÜN KARARIDIR ve
 * oyunun zorluğunu ayarlayan tek sayıdır.
 */
export const SCORE_TOLERANCE_FACTOR = 2;

export function scoreFor(key: StatKey, target: number, chosen: number): number {
  const deviation = STAT_DEVIATIONS[key];
  const tolerance = SCORE_TOLERANCE_FACTOR * deviation;

  // Sapma sıfır olamaz (0'a bölme); yapılandırma bozuksa tam isabet dışında
  // puan vermemek, sessizce herkese 100 vermekten iyidir.
  if (tolerance <= 0) return target === chosen ? 100 : 0;

  const ratio = Math.abs(chosen - target) / tolerance;
  return Math.round(100 * Math.max(0, 1 - ratio));
}

/** Bir turun toplam puanı — seçimlerin ortalaması, 0–100. */
export function totalScore(scores: readonly number[]): number {
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}

/**
 * BR-23 — "resmî toplam": kulüp kariyerinin TAMAMI artı A millî takım.
 *
 * Maç ve gol artık §1.3'ün yirmi dört liginden değil, oyuncunun bütün resmî
 * karşılaşmalarından gelir: lig, yerel kupa, Avrupa ve millî takım. Ürün
 * sahibinin istediği sayı budur ve kullanıcının kafasındaki sayı da budur —
 * "Kane 527 gol" derken kimse lig golünü kastetmiyor.
 *
 * PARÇALARDAN BİRİ BİLİNMİYORSA TOPLAM DA BİLİNMİYOR (§2.7). `null` sıfır
 * değildir: millî takım kaydı olmayan bir oyuncuda "hiç millî gol atmadı" ile
 * "millî takıma çıkıp çıkmadığını bilmiyoruz" veri kümesinde AYIRT EDİLEMEZ.
 * İkisini sıfır sayıp toplamak, ölçülemeyen bir yanlışı sessizce sayıya
 * çevirirdi. Ölçülen bedel §9.2'de: tanınırlık havuzunda gol için 2.789 →
 * 1.824, ama KOLAY havuzda 1.126 → 1.124, yani oyunun görünen yüzünde iki
 * oyuncu.
 */
export function officialTotal(
  club: number | null,
  national: number | null,
): number | null {
  return club === null || national === null ? null : club + national;
}

/**
 * Yalnızca §1.3 kapsamındaki yirmi dört ligi sayan istatistikler.
 *
 * Arayüz bunu göstermek zorundadır: kullanıcı bildiği gerçek toplamla
 * karşılaştırıp siteyi yanlış sanar. Liste 22 Ağustos 2026'da ÜÇTEN BİRE
 * indi — maç ve gol `officialTotal` ile kariyerin tamamına geçti; kulüp
 * sayısı geçemez, çünkü Vikipedi'nin kariyer tablosu bir TOPLAM satırıdır ve
 * "kaç kulüpte oynadı" sorusunu taşımaz.
 *
 * Yani bugün tek bir istatistik kapsama bağlı ve arayüzün uyarısı da tam
 * olarak onun üstünde duruyor.
 */
export const SCOPED_STATS: ReadonlySet<StatKey> = new Set<StatKey>(["clubs"]);

export function isScoped(key: StatKey): boolean {
  return SCOPED_STATS.has(key);
}

/**
 * BR-17 — bir oyuncu yalnızca bir istatistikte kullanılabilir.
 *
 * Kural olmasaydı kullanıcı altı istatistiğin hepsine aynı ismi yazıp
 * oyunun sorduğu şeyi — "farklı büyüklükler için farklı isimler" — atlardı.
 */
export function isPlayerAlreadyUsed(
  used: ReadonlyMap<StatKey, string>,
  playerId: string,
  target: StatKey,
): boolean {
  for (const [key, existing] of used) {
    if (key !== target && existing === playerId) return true;
  }
  return false;
}

/** Oyun bitti mi — altı istatistiğin hepsi cevaplandı mı? */
export function isRoundComplete(answered: number): boolean {
  return answered >= STAT_KEYS.length;
}
