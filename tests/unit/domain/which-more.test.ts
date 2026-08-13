import { describe, expect, it } from "vitest";
import { STAT_KEYS } from "@/domain/services/stat-match";
import {
  DIRECTIONS,
  EASY_MIN_LAST_YEAR,
  EASY_MIN_NATIONAL_CAPS,
  isDirection,
  isLevel,
  isPlayablePair,
  isWellKnown,
  LEVELS,
  MIN_GAP,
  opponentSide,
  otherSide,
  winningSide,
} from "@/domain/services/which-more";

/** §9.3 — "Hangisi daha" kuralları (BR-28…BR-32). */

describe("BR-29 — ayırt edilebilirlik bandı", () => {
  it("bandın ALTINDAKİ fark çift kurmaz", () => {
    // Boy bandı 3 cm: 180 ile 182 arasındaki soru bilgi değil kura olurdu.
    expect(isPlayablePair("heightCm", 180, 182)).toBe(false);
    expect(isPlayablePair("heightCm", 182, 180)).toBe(false);
  });

  it("bandın TAM ÜSTÜNDEKİ fark çift kurar", () => {
    expect(isPlayablePair("heightCm", 180, 183)).toBe(true);
    expect(isPlayablePair("heightCm", 183, 180)).toBe(true);
  });

  it("beraberlik hiçbir istatistikte kabul edilmez", () => {
    // Ölçüldü (§9.3): kulüp sayısında rastgele iki oyuncunun %14,1'i berabere.
    for (const key of STAT_KEYS) {
      expect(isPlayablePair(key, 50, 50)).toBe(false);
    }
  });

  it("her istatistiğin bandı en az 2'dir", () => {
    // 1'lik bir band beraberliği eler ama "3 kulüp mü 4 kulüp mü" sorusunu
    // bırakırdı; ölçüm o farkın cevaplanabilir olmadığını gösterdi.
    for (const key of STAT_KEYS) {
      expect(MIN_GAP[key]).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("yön", () => {
  it("iki yön tanınır, başkası tanınmaz", () => {
    expect(DIRECTIONS).toEqual(["more", "less"]);
    expect(isDirection("more")).toBe(true);
    expect(isDirection("less")).toBe(true);
    expect(isDirection("MORE")).toBe(false);
    expect(isDirection("")).toBe(false);
  });

  it("'more' büyük olanı, 'less' küçük olanı kazandırır", () => {
    expect(winningSide("more", 10, 3)).toBe("left");
    expect(winningSide("more", 3, 10)).toBe("right");
    expect(winningSide("less", 10, 3)).toBe("right");
    expect(winningSide("less", 3, 10)).toBe("left");
  });

  it("aynı iki değerde iki yön ZIT taraf verir", () => {
    // Yönün gerçekten kuralı çevirdiğinin kanıtı: aynı çiftte iki farklı
    // cevap doğru olamaz.
    expect(winningSide("more", 200, 100)).not.toBe(
      winningSide("less", 200, 100),
    );
  });
});

describe("BR-41 — bilindik oyuncu ölçütü", () => {
  it("İKİ ölçüt de gereklidir — biri yetmez", () => {
    // Ölçüm bunu söylüyordu (§9.3): tek başına millî maç 1.725 oyuncu veriyor
    // ve fazladan gelen 356'nın yalnızca %21,3'ü tanınıyor.
    expect(isWellKnown(40, 1995)).toBe(false); // millî maç var, çağdaş değil
    expect(isWellKnown(3, 2015)).toBe(false); // çağdaş, millî maç yok
    expect(isWellKnown(40, 2015)).toBe(true);
  });

  it("eşikler DÂHİLDİR", () => {
    expect(isWellKnown(EASY_MIN_NATIONAL_CAPS, EASY_MIN_LAST_YEAR)).toBe(true);
    expect(isWellKnown(EASY_MIN_NATIONAL_CAPS - 1, EASY_MIN_LAST_YEAR)).toBe(
      false,
    );
    expect(isWellKnown(EASY_MIN_NATIONAL_CAPS, EASY_MIN_LAST_YEAR - 1)).toBe(
      false,
    );
  });

  it("BİLİNMEYEN veri kolay havuza girmez", () => {
    // §2.7: eksik değer sıfır değildir. Ama burada asıl gerekçe yön: eksik
    // veriyi lehte yorumlamak, modun elemeye çalıştığı oyuncuyu içeri alırdı.
    expect(isWellKnown(null, 2015)).toBe(false);
    expect(isWellKnown(40, null)).toBe(false);
    expect(isWellKnown(null, null)).toBe(false);
  });

  it("ölçülen eşikleri taşır", () => {
    // Sayılar §9.3'te ölçüldü; değişirlerse belge de değişmeli.
    expect(EASY_MIN_NATIONAL_CAPS).toBe(20);
    expect(EASY_MIN_LAST_YEAR).toBe(2000);
  });

  it("seviye anahtarları tanınır, uydurma olan reddedilir", () => {
    for (const level of LEVELS) expect(isLevel(level)).toBe(true);
    expect(isLevel("orta")).toBe(false);
    expect(isLevel("")).toBe(false);
  });

  it("iki seviye vardır ve kolay olan İLKTİR", () => {
    // Sıra arayüzde de kullanılıyor (kurulum ekranı LEVELS'ı sırayla basıyor);
    // varsayılan olan başta durmalı.
    expect(LEVELS).toEqual(["easy", "hard"]);
  });
});

describe("BR-30 — dengeli rakip", () => {
  /**
   * Ölçülen sömürü (§9.3): rastgele çekimde kalan oyuncu her turda "o ana
   * kadarki en büyük" oluyor ve hiçbir şey bilmeden "hep kalanı seç" demek
   * %9,5–13,7 oranında 10+ seri yapıyordu. Yazı turanın iki tarafı da eşit
   * seçmesi bu kuralın tamamıdır.
   */
  it("yazı tura iki tarafı da seçer", () => {
    expect(opponentSide(0)).toBe("above");
    expect(opponentSide(0.49)).toBe("above");
    expect(opponentSide(0.5)).toBe("below");
    expect(opponentSide(0.99)).toBe("below");
  });

  it("bir taraf boşsa denenecek taraf ötekidir", () => {
    expect(otherSide("above")).toBe("below");
    expect(otherSide("below")).toBe("above");
  });

  it("rastgelelik DIŞARIDAN gelir — aynı sayı aynı tarafı verir", () => {
    // Domain kendi rastgeleliğini üretseydi bu kural test edilemezdi.
    expect(opponentSide(0.3)).toBe(opponentSide(0.3));
  });
});
