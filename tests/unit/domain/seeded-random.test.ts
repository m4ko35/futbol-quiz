import { describe, expect, it } from "vitest";
import {
  createSeededRandom,
  seedFromBytes,
} from "@/domain/value-objects/seeded-random";

/**
 * §12.8 BR-68 — tohumlu rastgelelik. ORTAK RAYIN temeli: aynı tohum her yerde
 * aynı akışı vermeli, yoksa iki oyuncu farklı düellolar görürdü.
 */
describe("createSeededRandom (§12.8, BR-68)", () => {
  it("aynı tohum BİREBİR aynı diziyi verir", () => {
    const a = createSeededRandom(12345);
    const b = createSeededRandom(12345);
    const first = Array.from({ length: 20 }, () => a());
    const second = Array.from({ length: 20 }, () => b());
    expect(second).toEqual(first);
  });

  it("üreteç durumu ilerletir — art arda çağrılar farklı sayılar verir", () => {
    const rng = createSeededRandom(7);
    const draws = new Set(Array.from({ length: 50 }, () => rng()));
    // 50 çekimin hepsi aynı çıkarsa üreteç ilerlemiyordur.
    expect(draws.size).toBeGreaterThan(40);
  });

  it("dönen her sayı [0, 1) aralığındadır", () => {
    const rng = createSeededRandom(0xdeadbeef);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("farklı tohumlar farklı diziler verir", () => {
    const a = Array.from({ length: 10 }, createSeededRandom(1));
    const b = Array.from({ length: 10 }, createSeededRandom(2));
    // eşit olması pratikte imkânsız; eşitse tohum akışa girmiyordur.
    expect(a).not.toEqual(b);
  });
});

describe("seedFromBytes (§12.8, BR-68)", () => {
  it("dört baytı deterministik bir tohuma indirger", () => {
    const bytes = Uint8Array.of(0x12, 0x34, 0x56, 0x78);
    expect(seedFromBytes(bytes)).toBe(0x12345678);
  });

  it("üst bit set olsa da işaretsiz kalır (>>> 0)", () => {
    const bytes = Uint8Array.of(0xff, 0xff, 0xff, 0xff);
    expect(seedFromBytes(bytes)).toBe(0xffffffff);
    expect(seedFromBytes(bytes)).toBeGreaterThanOrEqual(0);
  });

  it("eksik baytları 0 sayar — yine geçerli bir tohum", () => {
    expect(seedFromBytes(Uint8Array.of(0x01))).toBe(0x01000000);
    expect(seedFromBytes(new Uint8Array())).toBe(0);
  });

  it("tohum, üretecin girdisi olarak tekrarlanabilir", () => {
    const seed = seedFromBytes(Uint8Array.of(9, 8, 7, 6));
    const a = createSeededRandom(seed);
    const b = createSeededRandom(seed);
    expect(a()).toBe(b());
  });
});
