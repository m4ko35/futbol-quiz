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
