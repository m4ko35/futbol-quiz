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
  "weightKg",
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
 * Değerler ölçülerek konur; veri kümesi yenilendiğinde ölçüm TEKRARLANIR
 * (§10, Faz 4.6).
 *
 * ÖLÇÜM — BR-15 aday havuzunun tamamı, **1.904 oyuncu** (2026-07-31):
 *
 *                min   p25  medyan  p75   p95   max    ort     SD
 *   kulüp maçı   100   167    236   323   461   786   255,2  111,4
 *   kulüp golü     0     7     21    51   139   496    39,5   51,3
 *   kulüp sayısı   2     2      3     4     5    10     3,2    1,2
 *   A millî maç    0    10     34    68   116   233    42,7   38,2
 *   boy          159   176    181   185   192   203   181,0    6,6
 *   kilo          55    72     75    80    89   117    76,1    6,8
 *
 * ONDALIKLAR KORUNDU. `clubs` sapması 1,2 ve tam sayıya yuvarlamak onu 1'e
 * indirirdi; o durumda iki kulüp sapması doğrudan %0 olurdu. Ölçülen değerle
 * aynı sapma %17 alır — küçük bir fark gibi görünüyor ama altı istatistiğin
 * en dar olanında oyunun tamamını sertleştiriyordu.
 */
export const STAT_DEVIATIONS: Readonly<Record<StatKey, number>> = {
  appearances: 111.4,
  goals: 51.3,
  clubs: 1.2,
  nationalCaps: 38.2,
  heightCm: 6.6,
  weightKg: 6.8,
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
 * Maç, gol ve kulüp sayısı YALNIZCA §1.3 kapsamındaki altı ligi sayar.
 *
 * Arayüz bunu göstermek zorundadır: Ajax'ta geçen yıllar bu sayılara girmez
 * ve kullanıcı bildiği gerçek toplamla karşılaştırıp siteyi yanlış sanar.
 * Millî maç, boy ve kilo ise kapsamdan bağımsızdır — oyuncunun kendi
 * kaydından gelir.
 */
export const SCOPED_STATS: ReadonlySet<StatKey> = new Set<StatKey>([
  "appearances",
  "goals",
  "clubs",
]);

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
