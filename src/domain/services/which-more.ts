import type { StatKey } from "./stat-match";

/**
 * "Hangisi daha" modu — PROJECT.md §9.3.
 *
 * Bu dosya saf kuraldır: veri erişimi, rastgelelik kaynağı ve sunum burada
 * YOKTUR (§2.1). İstatistik anahtarları §9.2'den ödünç alınır — aynı sayılar
 * sorulduğu için ikinci bir liste tanımlamak iki doğruluk kaynağı yaratırdı.
 */

/**
 * Sorunun yönü.
 *
 * "less" bir süs değil: kullanıcı "hangisi daha kısa" diye de sorabilmeli.
 * Kural tarafında tek etkisi kazananın hangi uç olduğudur; havuz, band ve
 * dengeleme yönden BAĞIMSIZ çalışır.
 */
export const DIRECTIONS = ["more", "less"] as const;

export type Direction = (typeof DIRECTIONS)[number];

export function isDirection(value: string): value is Direction {
  return (DIRECTIONS as readonly string[]).includes(value);
}

/**
 * BR-41 — oyuncu havuzunun SEVİYESİ.
 *
 * NEDEN VAR. Tanınırlık havuzu (BR-31) "küratörlü kulüplerde 100+ maç, 2+
 * kulüp" diyor ve bu ölçüt bir oyuncunun KARİYERİNİ ölçüyor, TANINIRLIĞINI
 * değil. Ölçüldü (13 Ağustos 2026, Vikipedi dil sayısı şöhret ölçütü olarak):
 * havuzun **%78,8'i** ölçütün dışında kalıyor ve o kümenin medyanı **22 dil**,
 * yalnızca **%14,7'si** 40+ dilde madde taşıyor. Yani oyuncuların çoğunda
 * kullanıcı bilerek değil atarak oynuyordu.
 *
 * "hard" ZOR DEĞİL KARIŞIK demektir: bütün havuzdur, kolay oyuncuları da
 * içerir. Adı yine de "hard" çünkü kullanıcının seçtiği şey budur; seviye
 * bir vaat değil, havuzun genişliğidir.
 */
export const LEVELS = ["easy", "hard"] as const;

export type Level = (typeof LEVELS)[number];

export function isLevel(value: string): value is Level {
  return (LEVELS as readonly string[]).includes(value);
}

/**
 * "Bilindik" ölçütü — A millî maç ≥ 20 VE son kulüp dönemi ≥ 2000.
 *
 * NEDEN MİLLÎ MAÇ. Sezgisel aday kulüp maç sayısıydı ve YANLIŞTI: dil sayısıyla
 * korelasyonu yalnızca **r = 0,28**. Millî maçın korelasyonu **r = 0,78** —
 * çünkü millî takımda 20 maç yapan bir oyuncu ülkesinde tanınır. Ölçülen ayrım:
 *
 *   kolay havuz   medyan 47 dil · %66,7 tanınan (40+ dil)
 *   dışarıdakiler medyan 22 dil · %14,7 tanınan
 *
 * ÖLÇÜMÜN SINIRI YAZILI OLSUN: dil sayıları 150'şer oyuncudan oluşan iki
 * örneklemden geliyor, havuzun tamamından değil. Dışarıdakiler örneği ayrıca
 * EN ÇOK MAÇ YAPANLARDAN seçildi, yani gerçek küme ölçülenden daha az tanınır
 * — hata payı iddianın aleyhine değil lehine düşüyor.
 *
 * NEDEN İKİNCİ ÖLÇÜT DE GEREKLİ. Tek başına millî maç 1.725 oyuncu veriyor ve
 * bunların 356'sı 2000 öncesinde oynamayı bırakmış. O 356'nın medyanı **29
 * dil**, yalnızca **%21,3'ü** tanınıyor: küme ikiye bölünmüş, birkaç ölümsüz
 * (Beckenbauer 99 dil, Puskás 87) ve çok sayıda unutulmuş millî takım oyuncusu.
 * Millî maç sayısı bu ikisini AYIRAMIYOR (Capello 32 maç, Breitner 48), o yüzden
 * kümenin tamamı dışarıda kalıyor: kolay havuz %57,3'ten %66,7'ye çıkıyor.
 *
 * Karar ASİMETRİDEN çıktı: kolay modda tanımadığı bir oyuncuyu gören kullanıcı
 * rahatsız olur — modun var olma sebebi bu. Beckenbauer'in kolay havuzda
 * OLMADIĞINI ise fark etmez; yokluk görünmez. Yanlış negatif ucuz, yanlış
 * pozitif pahalı.
 *
 * YIL MUTLAKTIR, KAYAN PENCERE DEĞİL. "Son 25 yıl" deseydik havuz her yıl
 * sessizce değişir ve yukarıdaki ölçümlerin hiçbiri bir daha üretilemezdi.
 * 2000 bir çağ sınırıdır; kayarsa ölçülerek kaydırılır.
 *
 * ÖLÇÜT BİR VEKİLDİR ve öyle olduğu biliniyor: kolay havuzun **%33'ü** hâlâ
 * 40 dilin altında. İki bilinen kusur sınıfı var — küçük ülke millî takımları
 * yukarı çekiyor (James Debbah 72 maç, Liberya, 11 dil), ve dil sayısı YEREL
 * şöhreti göremiyor (Ünal Karaman 36 maç 18 dil, Ertuğrul Sağlam 26 maç 18 dil
 * — Türk kullanıcı ikisini de bilir, site Türkçedir). Doğru ölçüt ikisinin
 * BİRLEŞİMİ olurdu: 40+ dil VEYA Türkiye millî takımında 20+ maç. O, bir ETL
 * koşusu gerektiriyor ve 20 Eylül tazelemesine bırakıldı (§9.3, §10.2).
 */
export const EASY_MIN_NATIONAL_CAPS = 20;
export const EASY_MIN_LAST_YEAR = 2000;

/**
 * Bir oyuncu "bilindik" sayılır mı?
 *
 * Girdi iki sayı, bir oyuncu kaydı değil — kural, değerleri kimin nasıl
 * topladığından bağımsız (BR-29'un `isPlayablePair`'i ile aynı desen). `null`
 * "bilinmiyor" demektir ve bilinmeyen oyuncu kolay havuza GİRMEZ: eksik veriyi
 * lehte yorumlamak, modun elemeye çalıştığı tam da o oyuncuyu içeri alırdı.
 */
export function isWellKnown(
  nationalCaps: number | null,
  lastYear: number | null,
): boolean {
  if (nationalCaps === null || lastYear === null) return false;
  return (
    nationalCaps >= EASY_MIN_NATIONAL_CAPS && lastYear >= EASY_MIN_LAST_YEAR
  );
}

/**
 * BR-29 — bir çiftin kurulabilmesi için gereken asgari fark.
 *
 * NEDEN VAR: aynı değere sahip iki oyuncuda "doğru cevap" diye bir şey yok ve
 * kıl payı farklar bilgi değil kura sorar. Ölçüldü (§9.3, 6.464 tanınır
 * oyuncu) — rastgele iki oyuncunun berabere olma oranı:
 *
 *   kulüp maçı %0,3 · kulüp golü %1,7 · KULÜP SAYISI %14,1
 *   millî maç  %2,5 · boy        %4,9 · doğum yılı   %1,2
 *
 * NEDEN BU SAYILAR: her biri, çiftlerin ~%10–22'sini eleyen en küçük anlamlı
 * fark. Kulüp sayısı istisnadır — yalnızca 16 farklı değer taşıdığı için 2'lik
 * band çiftlerin %40,2'sini eliyor; daha küçüğü ise "3 kulüp mü 4 kulüp mü"
 * sorusuna dönerdi ve o soru cevaplanabilir değil.
 *
 * DOĞUM YILI 5 — ölçüldü: 1 yıl çiftlerin yalnızca %1,2'sini, 5 yıl **%10,8**'ini
 * eliyor, yani bandın alt ucu. Daha küçüğü seçilseydi "1985 doğumlu mu 1987
 * doğumlu mu" sorusu kalırdı; o soru bilgi değil kura sorar. `npm run
 * stats:measure` bu oranı yeniden ölçer.
 *
 * Bu, oyunun zorluğunu ayarlayan TEK sayıdır — §9.2'deki
 * `SCORE_TOLERANCE_FACTOR`'ün buradaki karşılığı.
 */
export const MIN_GAP: Readonly<Record<StatKey, number>> = {
  appearances: 25,
  goals: 5,
  clubs: 2,
  nationalCaps: 5,
  heightCm: 3,
  birthYear: 5,
};

/**
 * BR-29 — bu iki değerle bir soru sorulabilir mi?
 *
 * Girdi iki sayı, iki oyuncu değil: kural "fark yeterince büyük mü" sorusuna
 * bakar ve bu, değerleri kimin nasıl topladığından bağımsızdır.
 */
export function isPlayablePair(key: StatKey, a: number, b: number): boolean {
  return Math.abs(a - b) >= MIN_GAP[key];
}

export type Side = "left" | "right";

/**
 * Kazanan taraf — yön "more" ise büyük, "less" ise küçük olan.
 *
 * EŞİTLİK BURAYA GELEMEZ (BR-29 bandı eler) ama gelirse "left" döner ve bu
 * bir karar değil, savunma davranışıdır: çağıran taraf bandı doğrulamak
 * zorundadır. Sessizce "berabere" diye bir üçüncü sonuç uydurmak, oyunun
 * hiçbir yerinde karşılığı olmayan bir durum üretirdi.
 */
export function winningSide(
  direction: Direction,
  left: number,
  right: number,
): Side {
  if (direction === "more") return left >= right ? "left" : "right";
  return left <= right ? "left" : "right";
}

/**
 * BR-30 — dengeli rakip: yeni oyuncu kalanın hangi tarafından çekilecek?
 *
 * NEDEN YAZI TURA. Kazanan kaldığı için kalan oyuncu her turda "o ana kadarki
 * en büyük" olur; rakip havuzdan rastgele çekilseydi yeni oyuncunun daha büyük
 * çıkma olasılığı n'inci turda 1/(n+2)'ye düşerdi. Ölçüldü (§9.3): hiçbir şey
 * bilmeden "hep kalanı seç" diyen biri %9,5–13,7 oranında 10+ seri yapıyordu,
 * p99'da 315'e ulaşıyordu. Dengeli çekimde aynı strateji %0,1 — yazı turayla
 * birebir aynı.
 *
 * YÖNDEN BAĞIMSIZDIR. "less" oyununda kalan oyuncu en KÜÇÜK olur; dengeleme
 * yine iki tarafı eşitler, çünkü sorun yönde değil "kalanın uçta olmasında".
 *
 * Rastgelelik DIŞARIDAN gelir (§2.1): domain kendi rastgeleliğini üretmez,
 * aksi hâlde kural test edilemezdi.
 */
export function opponentSide(coin: number): "above" | "below" {
  return coin < 0.5 ? "above" : "below";
}

/** Bir tarafta aday kalmadıysa denenecek diğer taraf (BR-30). */
export function otherSide(side: "above" | "below"): "above" | "below" {
  return side === "above" ? "below" : "above";
}
