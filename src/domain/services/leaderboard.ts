import { dailySeed } from "../value-objects/daily-seed";

/**
 * Lider tablosu — PROJECT.md §11.5, BR-50.
 *
 * Bu dosya saf kuraldır: sorgu, depolama ve sunum burada YOKTUR (§2.1).
 * Girdisi "hangi turlar tamamlandı" listesidir; çıktısı sıralanmış tablodur.
 *
 * ÜÇ DÖNEM TEK KURALLA çalışır: dönem yalnızca hangi bulmaca günlerinin
 * toplanacağını belirler; toplama ve sıralama üçünde de aynıdır. Ayrı kod
 * yolları yazılsaydı üç tablo zamanla üç farklı davranışa ayrışırdı.
 */

/** API sözleşmesinin parçası (§6.5); etiketler sunum tarafındadır. */
export const LEADERBOARD_PERIODS = ["daily", "weekly", "allTime"] as const;

export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export function isLeaderboardPeriod(value: string): value is LeaderboardPeriod {
  return (LEADERBOARD_PERIODS as readonly string[]).includes(value);
}

/**
 * Bir dönemin kapsadığı bulmaca günleri — `null` ise sınır yoktur.
 *
 * Sınırlar gün TOHUMUDUR (20260815), tarih değil: tohum zaten uygulamanın gün
 * ölçütü (BR-49) ve ikinci bir gün tanımı yaratmak, ikisinin ayrışması
 * demektir.
 */
export interface PuzzleDayRange {
  readonly from: number;
  readonly to: number;
}

/** Tohumu takvim alanlarına ayırır; UTC burada dilim değil, takvim aracıdır. */
function seedToUtc(seed: number): Date {
  const year = Math.floor(seed / 10_000);
  const month = Math.floor((seed % 10_000) / 100);
  const day = seed % 100;
  return new Date(Date.UTC(year, month - 1, day));
}

function utcToSeed(date: Date): number {
  return (
    date.getUTCFullYear() * 10_000 +
    (date.getUTCMonth() + 1) * 100 +
    date.getUTCDate()
  );
}

/**
 * Haftanın ilk bulmaca günü — BR-50, **pazartesi 06:00**.
 *
 * Saat burada hiç geçmez ve geçmesine gerek yok: bulmaca günü zaten 06:00'da
 * başlıyor (BR-49), yani "pazartesi bulmaca günü" ile "pazartesi 06:00" aynı
 * şeydir. Sınır iki yerde tanımlansaydı biri değiştiğinde diğeri sessizce
 * yanlış kalırdı.
 */
export function weekStartSeed(seed: number): number {
  const date = seedToUtc(seed);
  // getUTCDay: 0 pazar … 6 cumartesi. Pazartesiden bu yana geçen gün sayısı.
  const sincePazartesi = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - sincePazartesi);
  return utcToSeed(date);
}

/**
 * Dönemin gün aralığı — `null` = tüm zamanlar (sınır yok).
 *
 * AY VE YIL SONLARI SAYI KARŞILAŞTIRMASIYLA ÇALIŞIR. 20260831..20260906 gibi
 * bir aralık 20260832..20260899 boşluğunu da kapsar ama o değerlere karşılık
 * gelen gün hiç üretilmez — tohum her zaman geçerli bir takvim gününden gelir.
 * Aralık bu yüzden takvim aritmetiği ile üretilir, sayıya `+6` eklenerek
 * değil: ay sonunda `+6` 20260837 gibi var olmayan bir sınır verirdi ve
 * eylülün ilk günleri sessizce haftanın dışında kalırdı.
 */
export function periodRange(
  period: LeaderboardPeriod,
  now: Date,
): PuzzleDayRange | null {
  const today = dailySeed(now);

  switch (period) {
    case "daily":
      return { from: today, to: today };
    case "weekly": {
      const from = weekStartSeed(today);
      const end = seedToUtc(from);
      end.setUTCDate(end.getUTCDate() + 6);
      return { from, to: utcToSeed(end) };
    }
    case "allTime":
      return null;
  }
}

/** Bir kullanıcının tamamladığı TEK tur (BR-45 geçmiş olanlar). */
export interface CompletedRound {
  readonly userId: string;
  readonly displayName: string;
  readonly puzzleDay: number;
  /** BR-44 — sunucuda birikmiş toplam, 0–600. */
  readonly points: number;
  readonly completedAt: Date;
}

export interface LeaderboardEntry {
  readonly userId: string;
  readonly displayName: string;
  readonly points: number;
  /** Kullanıcının bu toplama ULAŞTIĞI an — eşitlerin gösterim sırası. */
  readonly reachedAt: Date;
  /** Dönem içinde tamamladığı gün sayısı. */
  readonly days: number;
}

export interface RankedEntry extends LeaderboardEntry {
  /** 1'den başlar; eşitler AYNI sırayı paylaşır (1, 1, 3). */
  readonly rank: number;
}

/**
 * Turları kullanıcı başına toplar — BR-50.
 *
 * OYNANMAYAN GÜN SIFIR SAYILIR, EKSİK DEĞİL: toplama zaten öyle davranır ve
 * bu kasıtlıdır (§11.5). Toplam, düzenli oynayanı ödüllendirir; ürün sahibinin
 * amacı tam olarak budur. Bedeli de kabul edilmiştir — sonradan katılan biri
 * "tüm zamanlar" tablosunda başa geçemez.
 *
 * ULAŞMA ANI EN SON TURUN ANIDIR. Eşit puanlı iki kullanıcıdan hangisinin
 * önce gösterileceğine bu karar verir ve doğrusu "bu toplama önce kim ulaştı"
 * sorusudur — yani son turun tamamlanma anı. İlk turun anı kullanılsaydı,
 * pazartesi oynayıp cumaya kadar bekleyen biri, aynı puana perşembe ulaşan
 * birinin önünde görünürdü.
 *
 * AD SON TURDAN ALINIR: kullanıcı görünen adını değiştirirse tablo eskisini
 * göstermemeli.
 */
export function aggregate(
  rounds: readonly CompletedRound[],
): LeaderboardEntry[] {
  const byUser = new Map<string, LeaderboardEntry>();

  for (const round of rounds) {
    const current = byUser.get(round.userId);

    if (current === undefined) {
      byUser.set(round.userId, {
        userId: round.userId,
        displayName: round.displayName,
        points: round.points,
        reachedAt: round.completedAt,
        days: 1,
      });
      continue;
    }

    const isNewer = round.completedAt.getTime() > current.reachedAt.getTime();

    byUser.set(round.userId, {
      userId: round.userId,
      displayName: isNewer ? round.displayName : current.displayName,
      points: current.points + round.points,
      reachedAt: isNewer ? round.completedAt : current.reachedAt,
      days: current.days + 1,
    });
  }

  return [...byUser.values()];
}

/**
 * Sıralama — BR-50.
 *
 * EŞİTLER AYNI SIRAYI PAYLAŞIR (1, 1, 3) ve bir sonraki sıra atlanır; "1, 1,
 * 2" demek üçüncü kullanıcıya önündeki iki kişiden yalnızca birini görmek
 * gibi gelir.
 *
 * EŞİTLER ARASINDAKİ GÖSTERİM SIRASI BİR SIRALAMA ÖLÇÜTÜ DEĞİLDİR. Önce
 * tamamlayan önce gösterilir çünkü listenin bir sırası olmak zorunda; erken
 * saatte oynamak SIRA KAZANDIRMAZ — ikisi de aynı `rank` değerini taşır.
 *
 * SON ÇARE `userId`: iki tur aynı milisaniyede tamamlanabilir ve sıra o zaman
 * da kararlı olmalı, yoksa aynı tablo iki istekte iki farklı düzende döner.
 */
export function rank(entries: readonly LeaderboardEntry[]): RankedEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;

    const timeDiff = a.reachedAt.getTime() - b.reachedAt.getTime();
    if (timeDiff !== 0) return timeDiff;

    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
  });

  const ranked: RankedEntry[] = [];
  let currentRank = 0;
  let previousPoints: number | null = null;

  sorted.forEach((entry, index) => {
    if (previousPoints === null || entry.points !== previousPoints) {
      currentRank = index + 1;
      previousPoints = entry.points;
    }
    ranked.push({ ...entry, rank: currentRank });
  });

  return ranked;
}

/** Tabloyu tek çağrıda kurar: topla, sırala. */
export function buildLeaderboard(
  rounds: readonly CompletedRound[],
): RankedEntry[] {
  return rank(aggregate(rounds));
}

/**
 * "Benim sıram" — BR-47.
 *
 * Tablonun kendisi kimliğe bağlı DEĞİLDİR ve önbelleklenebilir; kullanıcının
 * kendi sırası ondan AYRI istenir. Bu ayrım olmasaydı tablo kişiye özel bir
 * yanıt olur ve paylaşılan önbellekten tamamen çıkardı.
 */
export function rankOf(
  ranked: readonly RankedEntry[],
  userId: string,
): RankedEntry | null {
  return ranked.find((entry) => entry.userId === userId) ?? null;
}
