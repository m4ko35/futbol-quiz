import { describe, expect, it } from "vitest";
import {
  createRandom,
  dailySeed,
  seedVariant,
  shuffled,
} from "@/domain/value-objects/daily-seed";

/** §9.1 BR-11 — günlük ızgara deterministiktir. */

describe("dailySeed", () => {
  it("aynı gün aynı tohumu verir", () => {
    expect(dailySeed(new Date("2026-07-31T00:00:00Z"))).toBe(
      dailySeed(new Date("2026-07-31T23:59:59Z")),
    );
  });

  it("farklı gün farklı tohum verir", () => {
    expect(dailySeed(new Date("2026-07-31T12:00:00Z"))).not.toBe(
      dailySeed(new Date("2026-08-01T12:00:00Z")),
    );
  });

  /**
   * Sunucunun yerel dilimi bir dağıtım tesadüfüdür. Sabitlenmeseydi ızgara,
   * hangi bölgedeki sunucunun yanıt verdiğine göre değişirdi.
   */
  it("tohum UTC'ye sabitlenmiştir", () => {
    // Aynı an, iki farklı yerel dilim gösterimi.
    expect(dailySeed(new Date("2026-07-31T01:00:00+03:00"))).toBe(
      dailySeed(new Date("2026-07-30T22:00:00Z")),
    );
  });

  it("YYYYMMDD biçimindedir", () => {
    expect(dailySeed(new Date("2026-07-31T00:00:00Z"))).toBe(20260731);
  });
});

describe("seedVariant", () => {
  it("her deneme farklı tohum üretir", () => {
    const base = 20260731;
    const seen = new Set(
      Array.from({ length: 40 }, (_, i) => seedVariant(base, i)),
    );
    expect(seen.size).toBe(40);
  });

  it("farklı günlerin denemeleri çakışmaz", () => {
    expect(seedVariant(20260731, 0)).not.toBe(seedVariant(20260801, 0));
  });
});

describe("createRandom", () => {
  it("aynı tohum aynı diziyi verir", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const first = Array.from({ length: 20 }, () => a());
    const second = Array.from({ length: 20 }, () => b());

    expect(first).toEqual(second);
  });

  it("farklı tohum farklı dizi verir", () => {
    const a = createRandom(1);
    const b = createRandom(2);
    expect(a()).not.toBe(b());
  });

  it("[0, 1) aralığında kalır", () => {
    const random = createRandom(20260731);
    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("shuffled", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("aynı tohumla aynı sırayı verir", () => {
    expect(shuffled(items, createRandom(7))).toEqual(
      shuffled(items, createRandom(7)),
    );
  });

  /**
   * Girdi değişseydi üretim denemeleri arasında havuz kayardı ve ikinci deneme
   * birincinin bıraktığı sıradan başlardı — determinizm bozulurdu.
   */
  it("girdiyi DEĞİŞTİRMEZ", () => {
    const original = [...items];
    shuffled(items, createRandom(7));
    expect(items).toEqual(original);
  });

  it("tüm öğeleri korur", () => {
    expect([...shuffled(items, createRandom(3))].sort((a, b) => a - b)).toEqual(
      items,
    );
  });

  it("boş diziyle çalışır", () => {
    expect(shuffled([], createRandom(1))).toEqual([]);
  });
});
