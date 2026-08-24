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
 * "Bilindik" ölçütü — §9.3, BR-41. İKİ SÜRÜM, GEÇİŞ VERİYLE TETİKLENİR.
 *
 * YENİ ÖLÇÜT (dil sayısı verisi geldiğinde): **40+ Wikipedia dili VEYA Türkiye
 * A millî takımında 20+ maç.** İlki küresel şöhret, ikincisi yerel şöhret
 * (site Türkçe). Bu, eski vekil ölçütün — "millî maç ≥ 20 VE son dönem ≥ 2000" —
 * amaçladığı şeyin DOĞRUDAN hâlidir.
 *
 * NEDEN DİL SAYISI. Eski ölçüt millî maçı ŞÖHRETİN VEKİLİ olarak kullanıyordu:
 * kulüp maçının dil sayısıyla korelasyonu r=0,28, millî maçınki r=0,78 idi.
 * Artık dil sayısının kendisi elimizde, vekile gerek yok. Eski ölçütün iki
 * bilinen kusuru da kapanıyor:
 *  · küçük ülke millî takımları (James Debbah, 72 maç, Liberya, 11 dil) 40 dil
 *    eşiğini geçemez ve DIŞARIDA kalır (eskiden 20+ maçla giriyordu);
 *  · pre-2000 efsaneleri (Beckenbauer 99 dil, Puskás 87) 2000 sınırına
 *    takılmadan İÇERİ girer (eskiden çağ sınırı onları eliyordu).
 *
 * NEDEN TÜRKİYE İSTİSNASI. Dil sayısı YEREL şöhreti göremiyor: Ünal Karaman
 * (18 dil), Ertuğrul Sağlam (18 dil) Türk kullanıcının bildiği ama 40 dilin
 * altında kalan isimler. Site Türkçe olduğu için `nationality = "TR"` ve 20+
 * A millî maç ikinci bir "bilindik" yolu açar.
 *
 * GEÇİŞ NULL-YEDEKLİDİR. `languageCount` sütunu dolana (dolduran ilk ETL
 * koşusu) kadar `null`; o sürece kadar ESKİ ölçüt uygulanır ve oyun davranışı
 * DEĞİŞMEZ. Sütun dolunca yeni ölçüt kendiliğinden devreye girer — veri,
 * anahtarın kendisidir, ayrı bir bayrak yok. `EASY_MIN_LAST_YEAR` bu yüzden
 * hâlâ burada: YALNIZCA geçiş yedeğinde kullanılıyor.
 *
 * `null` dil sayısı "henüz çekilmedi" demektir; eksik `nationalCaps`/`lastYear`
 * ise "bilinmiyor" ve o oyuncu kolay havuza GİRMEZ (eksik veriyi lehte
 * yorumlamak, modun elemeye çalıştığı oyuncuyu içeri alırdı).
 */
export const EASY_MIN_LANGUAGES = 40;
export const EASY_MIN_NATIONAL_CAPS = 20;
export const EASY_MIN_LAST_YEAR = 2000;

/** Yerel şöhret yolunun ülkesi — site Türkçe olduğu için Türkiye (ISO alpha-2). */
export const LOCAL_FAME_COUNTRY = "TR";

/**
 * `isWellKnown` girdisi — dört alan bir NESNEDE, dört konumlu argüman değil:
 * ikisi `number | null`, biri `string | null`; sırayı karıştırmak sessiz bir
 * hata olurdu.
 */
export interface WellKnownInput {
  /** Wikipedia dil sayısı. `null` = henüz çekilmedi → geçiş yedeği devreye girer. */
  readonly languageCount: number | null;
  /** Uyruk, ISO 3166-1 alpha-2 — yerel şöhret yolu için ("TR"). */
  readonly nationality: string | null;
  /** A millî takım maç sayısı (BR-14). */
  readonly nationalCaps: number | null;
  /** Son kulüp dönemi yılı — YALNIZCA geçiş yedeğinde okunur. */
  readonly lastYear: number | null;
}

/**
 * Bir oyuncu "bilindik" sayılır mı? (BR-41)
 *
 * Girdi ham değerler, bir oyuncu kaydı değil — kural, değerleri kimin nasıl
 * topladığından bağımsız (BR-29'un `isPlayablePair`'i ile aynı desen).
 */
export function isWellKnown(input: WellKnownInput): boolean {
  const { languageCount, nationality, nationalCaps, lastYear } = input;

  // YENİ ÖLÇÜT — dil sayısı verisi geldi (küresel VEYA yerel şöhret).
  if (languageCount !== null) {
    if (languageCount >= EASY_MIN_LANGUAGES) return true;
    return (
      nationality === LOCAL_FAME_COUNTRY &&
      nationalCaps !== null &&
      nationalCaps >= EASY_MIN_NATIONAL_CAPS
    );
  }

  // GEÇİŞ YEDEĞİ — dil sayısı henüz yok; eski vekil ölçüt (davranış aynı kalsın).
  if (nationalCaps === null || lastYear === null) return false;
  return (
    nationalCaps >= EASY_MIN_NATIONAL_CAPS && lastYear >= EASY_MIN_LAST_YEAR
  );
}

/**
 * BR-29 — bir çiftin kurulabilmesi için gereken asgari fark.
 *
 * NEDEN VAR: aynı değere sahip iki oyuncuda "doğru cevap" diye bir şey yok ve
 * kıl payı farklar bilgi değil kura sorar.
 *
 * ÖLÇÜT: bandın ELEDİĞİ çift oranı ~%10 olmalı. Daha düşüğü ayırt edilemeyen
 * soruları içeride bırakır, daha yükseği havuzu gereksiz daraltır. Oran
 * `npm run stats:measure` ile iki havuzda birden ölçülür — kolay havuz
 * tanınırlık havuzunun beşte biridir ve dağılımı DARDIR, aynı band orada
 * bambaşka bir oranı eleyebilir.
 *
 * ÖLÇÜM (22 Ağustos 2026, elenen çift oranı — zor havuz / kolay havuz):
 *
 *   resmî maç    band 25: %7,9 / %8,0   band 30: %9,6 / %9,6
 *                band 35: %11,2 / %11,3 ← SEÇİLEN   band 40: %12,8 / %12,9
 *   resmî gol    band  5: %4,9 / %4,5   band  8: %7,8 / %7,2
 *                band 10: %9,8 / %9,1  ← SEÇİLEN   band 12: %11,7 / %10,9
 *
 * İKİSİ DE BR-23 YÜZÜNDEN BÜYÜDÜ (§9.2): maç ve gol artık kariyerin tamamını
 * sayıyor, medyan 311 → 534 ve 26 → 57. Eski bandlar aynı bıraksaydı oyun
 * sessizce kolaylaşırdı — 5 gollük bir fark, 26 gollük bir medyanda anlamlı,
 * 57'lik bir medyanda gürültüdür. Eski bandların eski tanımda elediği oran
 * %11,5 ve %10,0 idi; yeni bandlar tam olarak oraya oturuyor, yani oyunun
 * zorluğu KORUNDU, değiştirilmedi.
 *
 * KULÜP SAYISI İSTİSNADIR: yalnızca 16 farklı değer taşıdığı için 2'lik band
 * çiftlerin %40,1'ini eliyor; daha küçüğü "3 kulüp mü 4 kulüp mü" sorusuna
 * dönerdi ve o soru cevaplanabilir değil.
 *
 * DOĞUM YILI 5 — 1 yıl çiftlerin yalnızca %1,2'sini, 5 yıl %10,7'sini eliyor.
 * Değerleri BR-23'ten etkilenmedi, band da değişmedi.
 *
 * Bu, oyunun zorluğunu ayarlayan TEK sayıdır — §9.2'deki
 * `SCORE_TOLERANCE_FACTOR`'ün buradaki karşılığı.
 */
export const MIN_GAP: Readonly<Record<StatKey, number>> = {
  appearances: 35,
  goals: 10,
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
