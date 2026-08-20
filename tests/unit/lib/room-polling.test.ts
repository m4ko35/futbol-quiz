import { describe, expect, it } from "vitest";
import type { RoomDto, RoomSideDto } from "@/application/use-cases/rooms";
import { STAT_KEYS } from "@/domain/services/stat-match";
import {
  pollDelay,
  pollPhase,
  pollSignature,
  POLL_MAX_MS,
} from "@/lib/room-polling";

/**
 * Yoklama siyaseti — PROJECT.md §12.1.
 *
 * Bu testler bir zamanlayıcı ilerletmiyor: ölçülen şey aritmetik ve o
 * aritmetiğin taşıdığı KARARLAR. Hız sınırı dakikada 60 ve istemci anahtarı
 * IP olduğu için (§7.8) aynı evden oynayan iki arkadaş bütçeyi paylaşıyor;
 * aşağıdaki sayılar o bütçenin nasıl harcandığını sabitliyor.
 */

function taraf(answered: number, points: number | null = null): RoomSideDto {
  return { displayName: "X", answered, points, answers: null };
}

function oda(patch: Partial<RoomDto> = {}): RoomDto {
  return {
    code: "BKJ7TZ",
    status: "oynaniyor",
    expiresAt: "2026-08-20T11:00:00.000Z",
    target: null,
    me: taraf(0),
    opponent: taraf(0),
    outcome: "devam",
    ...patch,
  };
}

describe("pollPhase", () => {
  it("lobide bekleyen oda `lobi` düzenindedir", () => {
    expect(pollPhase(oda({ status: "bekliyor", opponent: null }))).toBe("lobi");
  });

  it("oynarken `oynuyorum` düzenindedir", () => {
    expect(pollPhase(oda({ me: taraf(3) }))).toBe("oynuyorum");
  });

  it("altı istatistik bitince `rakibi-bekliyorum`a geçer", () => {
    expect(pollPhase(oda({ me: taraf(STAT_KEYS.length) }))).toBe(
      "rakibi-bekliyorum",
    );
  });

  /**
   * DURUM ARTIK DEĞİŞEMEZ, sormaya devam etmek boşuna istek üretmek olurdu:
   * `bitti` geri dönmüyor, `suresi-doldu` da öyle (§12.3).
   */
  it("bitmiş odada yoklama DURUR", () => {
    expect(pollPhase(oda({ status: "bitti" }))).toBeNull();
  });

  it("sönmüş odada yoklama DURUR", () => {
    expect(pollPhase(oda({ status: "suresi-doldu" }))).toBeNull();
  });
});

describe("pollDelay", () => {
  it("ilk yoklama lobide üç saniyededir", () => {
    expect(pollDelay("lobi", 0)).toBe(3_000);
  });

  it("oynarken seyrektir — her cevap odayı zaten tazeliyor", () => {
    expect(pollDelay("oynuyorum", 0)).toBe(12_000);
  });

  it("değişiklik gelmedikçe aralık büyür", () => {
    expect(pollDelay("lobi", 1)).toBe(4_500);
    expect(pollDelay("lobi", 2)).toBe(6_750);
    expect(pollDelay("lobi", 3)).toBe(10_125);
  });

  it("tavanı aşmaz", () => {
    expect(pollDelay("lobi", 4)).toBe(POLL_MAX_MS);
    expect(pollDelay("lobi", 50)).toBe(POLL_MAX_MS);
  });

  /**
   * OTUZ DAKİKALIK LOBİNİN TOPLAM MALİYETİ. Sabit üç saniye 600 istek ederdi;
   * büyüme onu dörtte birine indiriyor. Sayı burada yazılı çünkü değiştirmek
   * isteyen biri neyi değiştirdiğini görmeli.
   */
  it("otuz dakikalık bekleme yaklaşık 125 istek eder", () => {
    let gecen = 0;
    let sayi = 0;

    for (let quiet = 0; gecen < 30 * 60_000; quiet += 1) {
      gecen += pollDelay("lobi", quiet);
      sayi += 1;
    }

    expect(sayi).toBeGreaterThan(115);
    expect(sayi).toBeLessThan(135);
  });
});

describe("pollSignature", () => {
  it("iki sayaç ve durum aynıysa yanıt YENİ SAYILMAZ", () => {
    const a = oda({ me: taraf(2), opponent: taraf(1) });
    const b = oda({
      me: taraf(2),
      opponent: taraf(1),
      // Her yanıtta yeniden üretilen alanlar imzaya girmemeli.
      expiresAt: "2026-08-20T11:00:05.000Z",
    });

    expect(pollSignature(a)).toBe(pollSignature(b));
  });

  it("rakip bir cevap yazınca imza değişir", () => {
    const once = pollSignature(oda({ opponent: taraf(1) }));
    const sonra = pollSignature(oda({ opponent: taraf(2) }));

    expect(once).not.toBe(sonra);
  });

  it("rakip henüz yokken ile sıfır cevaplı rakip AYRI şeylerdir", () => {
    expect(pollSignature(oda({ opponent: null }))).not.toBe(
      pollSignature(oda({ opponent: taraf(0) })),
    );
  });
});
