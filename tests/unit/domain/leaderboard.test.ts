import { describe, expect, it } from "vitest";
import {
  aggregate,
  buildLeaderboard,
  isLeaderboardPeriod,
  LEADERBOARD_PERIODS,
  periodRange,
  rank,
  rankOf,
  weekStartSeed,
  type CompletedRound,
  type LeaderboardEntry,
} from "@/domain/services/leaderboard";
import { dailySeed } from "@/domain/value-objects/daily-seed";

/**
 * §11.5 BR-50 — üç dönem, tek kural.
 *
 * Tarihler Türkiye saatiyle yazılır (`+03:00`), çünkü gün sınırı orada
 * (BR-49); UTC yazmak testin ne söylediğini okunmaz kılardı.
 */

const round = (
  userId: string,
  puzzleDay: number,
  points: number,
  completedAt: string,
  displayName = userId,
): CompletedRound => ({
  userId,
  displayName,
  puzzleDay,
  points,
  completedAt: new Date(completedAt),
});

const entry = (
  userId: string,
  points: number,
  reachedAt: string,
): LeaderboardEntry => ({
  userId,
  displayName: userId,
  points,
  reachedAt: new Date(reachedAt),
  days: 1,
});

describe("dönem aralığı — BR-50", () => {
  it("üç dönem vardır", () => {
    expect(LEADERBOARD_PERIODS).toEqual(["daily", "weekly", "allTime"]);
    expect(isLeaderboardPeriod("weekly")).toBe(true);
    expect(isLeaderboardPeriod("aylik")).toBe(false);
  });

  it("günlük yalnızca bugünü kapsar", () => {
    const now = new Date("2026-08-15T12:00:00+03:00");

    expect(periodRange("daily", now)).toEqual({
      from: 20260815,
      to: 20260815,
    });
  });

  it("tüm zamanlar sınırsızdır", () => {
    expect(periodRange("allTime", new Date())).toBeNull();
  });

  /**
   * Gün sınırıyla KENETLİ. 15 Ağustos 2026 cumartesi; saat 05:00 hâlâ CUMA'nın
   * bulmacasıdır (BR-49), yani haftalık aralık da bir gün geriden başlar.
   */
  it("hafta PAZARTESİ başlar", () => {
    const cumartesi = new Date("2026-08-15T12:00:00+03:00");

    expect(periodRange("weekly", cumartesi)).toEqual({
      from: 20260810, // pazartesi
      to: 20260816, // pazar
    });
  });

  it("pazartesi 06:00'dan önce ÖNCEKİ hafta sayılır", () => {
    const pazartesiSabah = new Date("2026-08-17T05:00:00+03:00");

    // 17 Ağustos pazartesi ama 05:00 hâlâ 16 Ağustos pazarın bulmacası.
    expect(dailySeed(pazartesiSabah)).toBe(20260816);
    expect(periodRange("weekly", pazartesiSabah)).toEqual({
      from: 20260810,
      to: 20260816,
    });
  });

  it("pazartesi 06:00'da YENİ hafta başlar", () => {
    const pazartesiSonra = new Date("2026-08-17T06:00:00+03:00");

    expect(periodRange("weekly", pazartesiSonra)).toEqual({
      from: 20260817,
      to: 20260823,
    });
  });

  /**
   * `+6` SAYIYA EKLENSEYDİ 20260837 çıkardı ve eylülün ilk günleri sessizce
   * haftanın dışında kalırdı.
   */
  it("hafta AY sınırını doğru geçer", () => {
    const carsamba = new Date("2026-09-02T12:00:00+03:00");

    expect(periodRange("weekly", carsamba)).toEqual({
      from: 20260831,
      to: 20260906,
    });
  });

  it("hafta YIL sınırını doğru geçer", () => {
    const persembe = new Date("2026-12-31T12:00:00+03:00");

    expect(periodRange("weekly", persembe)).toEqual({
      from: 20261228,
      to: 20270103,
    });
  });

  it("weekStartSeed pazar gününü ÖNCEKİ pazartesiye bağlar", () => {
    // 16 Ağustos 2026 pazar; haftanın son günü, ilk günü değil.
    expect(weekStartSeed(20260816)).toBe(20260810);
    expect(weekStartSeed(20260810)).toBe(20260810);
  });
});

describe("aggregate", () => {
  it("kullanıcı başına toplar", () => {
    const entries = aggregate([
      round("a", 20260810, 400, "2026-08-10T10:00:00+03:00"),
      round("a", 20260811, 350, "2026-08-11T10:00:00+03:00"),
      round("b", 20260810, 500, "2026-08-10T09:00:00+03:00"),
    ]);

    const a = entries.find((e) => e.userId === "a");
    expect(a?.points).toBe(750);
    expect(a?.days).toBe(2);
    expect(entries.find((e) => e.userId === "b")?.points).toBe(500);
  });

  /**
   * OYNANMAYAN GÜN SIFIR SAYILIR. Üç gün oynayan, yedi gün oynayanın
   * gerisinde kalır ve bu kasıtlı (§11.5).
   */
  it("eksik günler için ceza YOK, ödül de yok — yalnızca toplanmaz", () => {
    const [az] = aggregate([
      round("az", 20260810, 600, "2026-08-10T10:00:00+03:00"),
    ]);

    expect(az?.points).toBe(600);
    expect(az?.days).toBe(1);
  });

  /**
   * ULAŞMA ANI SON TURUNKİDİR: pazartesi oynayıp bekleyen biri, aynı puana
   * perşembe ulaşan birinin önünde görünmemeli.
   */
  it("ulaşma anı EN SON turun anıdır", () => {
    const [a] = aggregate([
      round("a", 20260810, 300, "2026-08-10T10:00:00+03:00"),
      round("a", 20260813, 300, "2026-08-13T10:00:00+03:00"),
    ]);

    expect(a?.reachedAt.toISOString()).toBe(
      new Date("2026-08-13T10:00:00+03:00").toISOString(),
    );
  });

  it("sıra bozuk gelse de en son turu bulur", () => {
    const [a] = aggregate([
      round("a", 20260813, 300, "2026-08-13T10:00:00+03:00"),
      round("a", 20260810, 300, "2026-08-10T10:00:00+03:00"),
    ]);

    expect(a?.reachedAt.toISOString()).toBe(
      new Date("2026-08-13T10:00:00+03:00").toISOString(),
    );
  });

  it("adı EN SON turdan alır — ad değişikliği tabloya yansır", () => {
    const [a] = aggregate([
      round("a", 20260810, 300, "2026-08-10T10:00:00+03:00", "EskiAd"),
      round("a", 20260813, 300, "2026-08-13T10:00:00+03:00", "YeniAd"),
    ]);

    expect(a?.displayName).toBe("YeniAd");
  });

  it("boş liste boş tablo verir", () => {
    expect(aggregate([])).toEqual([]);
  });
});

describe("rank — BR-50", () => {
  it("puana göre azalan sıralar", () => {
    const ranked = rank([
      entry("a", 300, "2026-08-10T10:00:00+03:00"),
      entry("b", 500, "2026-08-10T10:00:00+03:00"),
      entry("c", 400, "2026-08-10T10:00:00+03:00"),
    ]);

    expect(ranked.map((e) => e.userId)).toEqual(["b", "c", "a"]);
    expect(ranked.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  /**
   * "1, 1, 2" demek üçüncü kullanıcıya önündeki iki kişiden yalnızca birini
   * görmek gibi gelir.
   */
  it("eşitler AYNI sırayı paylaşır ve sonraki sıra ATLANIR", () => {
    const ranked = rank([
      entry("a", 500, "2026-08-10T10:00:00+03:00"),
      entry("b", 500, "2026-08-10T11:00:00+03:00"),
      entry("c", 300, "2026-08-10T12:00:00+03:00"),
    ]);

    expect(ranked.map((e) => e.rank)).toEqual([1, 1, 3]);
  });

  /**
   * ERKEN OYNAMAK SIRA KAZANDIRMAZ: gösterim sırası değişir, `rank` değişmez.
   */
  it("eşitlerde önce tamamlayan önce GÖSTERİLİR ama sırası aynıdır", () => {
    const ranked = rank([
      entry("gec", 500, "2026-08-10T18:00:00+03:00"),
      entry("erken", 500, "2026-08-10T07:00:00+03:00"),
    ]);

    expect(ranked.map((e) => e.userId)).toEqual(["erken", "gec"]);
    expect(ranked[0]?.rank).toBe(ranked[1]?.rank);
  });

  /**
   * Aynı milisaniyede tamamlanan iki tur mümkündür; sıra kararlı olmazsa aynı
   * tablo iki istekte iki farklı düzende döner.
   */
  it("aynı an ve aynı puanda sıra KARARLIDIR", () => {
    const an = "2026-08-10T10:00:00+03:00";
    const ilk = rank([entry("b", 500, an), entry("a", 500, an)]);
    const ikinci = rank([entry("a", 500, an), entry("b", 500, an)]);

    expect(ilk.map((e) => e.userId)).toEqual(["a", "b"]);
    expect(ikinci.map((e) => e.userId)).toEqual(["a", "b"]);
  });

  it("üç kişilik eşitlikten sonra sıra dörde atlar", () => {
    const ranked = rank([
      entry("a", 500, "2026-08-10T10:00:00+03:00"),
      entry("b", 500, "2026-08-10T11:00:00+03:00"),
      entry("c", 500, "2026-08-10T12:00:00+03:00"),
      entry("d", 100, "2026-08-10T13:00:00+03:00"),
    ]);

    expect(ranked.map((e) => e.rank)).toEqual([1, 1, 1, 4]);
  });

  it("girdiyi DEĞİŞTİRMEZ", () => {
    const entries = [
      entry("a", 300, "2026-08-10T10:00:00+03:00"),
      entry("b", 500, "2026-08-10T10:00:00+03:00"),
    ];
    rank(entries);

    expect(entries.map((e) => e.userId)).toEqual(["a", "b"]);
  });

  it("boş tablo sıralanabilir", () => {
    expect(rank([])).toEqual([]);
  });
});

describe("buildLeaderboard ve rankOf", () => {
  it("haftalık tablo: toplam, sıra ve gün sayısı", () => {
    const ranked = buildLeaderboard([
      round("a", 20260810, 400, "2026-08-10T10:00:00+03:00"),
      round("a", 20260811, 300, "2026-08-11T10:00:00+03:00"),
      round("b", 20260810, 600, "2026-08-10T10:00:00+03:00"),
      round("c", 20260812, 700, "2026-08-12T10:00:00+03:00"),
    ]);

    expect(ranked.map((e) => [e.userId, e.points, e.rank])).toEqual([
      ["a", 700, 1],
      ["c", 700, 1],
      ["b", 600, 3],
    ]);
  });

  /**
   * BR-47 — "benim sıram" tablodan AYRI istenir; tablo kimliğe bağlı değildir
   * ve önbelleklenebilir.
   */
  it("rankOf kullanıcının satırını bulur", () => {
    const ranked = buildLeaderboard([
      round("a", 20260810, 400, "2026-08-10T10:00:00+03:00"),
      round("b", 20260810, 600, "2026-08-10T10:00:00+03:00"),
    ]);

    expect(rankOf(ranked, "a")?.rank).toBe(2);
    expect(rankOf(ranked, "yok")).toBeNull();
  });
});
