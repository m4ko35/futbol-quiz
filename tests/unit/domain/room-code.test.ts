import { describe, expect, it } from "vitest";
import { InvalidIdentifierError } from "@/domain/errors/domain-error";
import {
  isRoomCode,
  normalizeRoomCode,
  roomCode,
  roomCodeFromBytes,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from "@/domain/value-objects/room-code";

/**
 * §12 BR-55 — oda kodu.
 *
 * Buradaki denetimlerin çoğu ALFABENİN KENDİSİNİ sınıyor, biçimini değil:
 * kodun değeri, telefonda söylendiğinde karşıya doğru ulaşmasında.
 */

describe("alfabe — BR-55'in üç elemesi", () => {
  it("karışan işaretleri taşımaz", () => {
    for (const glyph of ["0", "O", "1", "I", "L"]) {
      expect(ROOM_CODE_ALPHABET).not.toContain(glyph);
    }
  });

  it("hiç sesli harf taşımaz — kelime oluşumu sınıfını kapatır", () => {
    for (const vowel of ["A", "E", "I", "O", "U"]) {
      expect(ROOM_CODE_ALPHABET).not.toContain(vowel);
    }
  });

  it("Türk alfabesinde olmayan harfleri taşımaz", () => {
    for (const foreign of ["Q", "W", "X"]) {
      expect(ROOM_CODE_ALPHABET).not.toContain(foreign);
    }
  });

  it("hiçbir işaret tekrarlanmaz", () => {
    expect(new Set(ROOM_CODE_ALPHABET).size).toBe(ROOM_CODE_ALPHABET.length);
  });

  it("yirmi beş işaret taşır", () => {
    expect(ROOM_CODE_ALPHABET.length).toBe(25);
  });
});

describe("normalizeRoomCode — insanın yazdığını koda indirger", () => {
  it("küçük harfi büyütür", () => {
    expect(normalizeRoomCode("bkj7tz")).toBe("BKJ7TZ");
  });

  it("tireyi ve boşluğu atar", () => {
    expect(normalizeRoomCode(" BKJ-7 TZ ")).toBe("BKJ7TZ");
  });

  /**
   * Türkçe yerelde `"i".toUpperCase()` `"İ"` verir. Alfabede ne `I` ne `İ`
   * var, yani iki durumda da reddediliyor — ama reddin GEREKÇESİ yerelin ne
   * olduğuna bağlı olmamalı.
   */
  it("küçük i'yi yerelden bağımsız çevirir", () => {
    expect(normalizeRoomCode("i")).toBe("I");
  });
});

describe("isRoomCode / roomCode", () => {
  it("alfabeden üretilmiş altı karakterli kodu kabul eder", () => {
    expect(isRoomCode("BKJ7TZ")).toBe(true);
    expect(roomCode("bkj-7tz")).toBe("BKJ7TZ");
  });

  it("alfabede olmayan harfi reddeder", () => {
    expect(isRoomCode("BKJ7TA")).toBe(false);
    expect(() => roomCode("BKJ7TA")).toThrow(InvalidIdentifierError);
  });

  it("kısa ve uzun kodu reddeder", () => {
    expect(isRoomCode("BKJ7T")).toBe(false);
    expect(isRoomCode("BKJ7TZZ")).toBe(false);
  });

  it("boş dizeyi reddeder", () => {
    expect(isRoomCode("")).toBe(false);
  });
});

describe("roomCodeFromBytes — yanlılık elemesi", () => {
  it("her bayt için alfabenin karşılık gelen işaretini verir", () => {
    const code = roomCodeFromBytes(new Uint8Array([0, 1, 2, 3, 4, 5]));

    expect(code).toBe(
      [0, 1, 2, 3, 4, 5].map((i) => ROOM_CODE_ALPHABET[i]).join(""),
    );
  });

  /**
   * 256 = 10 × 25 + 6. Sınır 250; `bayt % 25` doğrudan kullanılsaydı 250–255
   * arası altı bayt ilk altı indise FAZLADAN düşerdi ve o indisler diğerlerine
   * göre daha sık çıkardı.
   */
  it("250 ve üstündeki baytları atar", () => {
    const code = roomCodeFromBytes(
      new Uint8Array([250, 251, 252, 253, 254, 255, 0, 0, 0, 0, 0, 0]),
    );

    expect(code).toBe(ROOM_CODE_ALPHABET[0]?.repeat(ROOM_CODE_LENGTH));
  });

  it("bayt yetmezse null döner — yanlı koda düşmez", () => {
    expect(roomCodeFromBytes(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(roomCodeFromBytes(new Uint8Array([250, 250, 250]))).toBeNull();
  });

  it("ürettiği her kod kendi doğrulayıcısından geçer", () => {
    for (let start = 0; start < 250; start += 7) {
      const bytes = Uint8Array.from({ length: ROOM_CODE_LENGTH }, (_, i) =>
        Math.min(249, start + i),
      );
      const code = roomCodeFromBytes(bytes);

      expect(code).not.toBeNull();
      expect(isRoomCode(code ?? "")).toBe(true);
    }
  });

  /** Eşleme yanlı değil: 250 baytın her indise tam onar kez düşmesi gerekir. */
  it("kabul edilen baytlar alfabeye eşit dağılır", () => {
    const counts = new Map<string, number>();

    for (let byte = 0; byte < 250; byte += 1) {
      const glyph = ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length] ?? "";
      counts.set(glyph, (counts.get(glyph) ?? 0) + 1);
    }

    expect(counts.size).toBe(ROOM_CODE_ALPHABET.length);
    expect([...counts.values()].every((n) => n === 10)).toBe(true);
  });
});
