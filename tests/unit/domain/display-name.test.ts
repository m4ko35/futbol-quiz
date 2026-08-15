import { describe, expect, it } from "vitest";
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  displayNameKey,
  displayNameRejectionMessage,
  validateDisplayName,
  type DisplayNameRejection,
} from "@/domain/value-objects/display-name";

/**
 * §11 BR-46 — lider tablosunda görünen ad.
 *
 * Tablo HERKESE AÇIKTIR; buradaki kuralların çoğu bir görünüm tercihi değil,
 * taklidi yapısal olarak imkânsız kılma girişimidir.
 */

const ok = (raw: string): string => {
  const result = validateDisplayName(raw);
  if (!result.ok) throw new Error(`beklenmedik ret: ${result.reason}`);
  return result.value;
};

const rejects = (raw: string): DisplayNameRejection => {
  const result = validateDisplayName(raw);
  if (result.ok) throw new Error(`beklenmedik kabul: ${result.value}`);
  return result.reason;
};

describe("validateDisplayName — biçim", () => {
  it("normal adı kabul eder", () => {
    expect(ok("Mehmet")).toBe("Mehmet");
    expect(ok("Ali_42")).toBe("Ali_42");
    expect(ok("Kadir-Can")).toBe("Kadir-Can");
  });

  it("Türkçe harfleri kabul eder", () => {
    expect(ok("Şükrü")).toBe("Şükrü");
    expect(ok("Gülşah")).toBe("Gülşah");
    expect(ok("İbrahim")).toBe("İbrahim");
  });

  it("baştaki ve sondaki boşluğu atar", () => {
    expect(ok("  Mehmet  ")).toBe("Mehmet");
  });

  it("iç boşlukları TEKE indirir", () => {
    // Aksi hâlde "Ali  Can" ile "Ali Can" tabloda iki ayrı satır olurdu.
    expect(ok("Ali    Can")).toBe("Ali Can");
  });

  it("boş ve yalnızca boşluktan oluşan adı reddeder", () => {
    expect(rejects("")).toBe("bos");
    expect(rejects("     ")).toBe("bos");
  });

  it("uzunluk sınırlarını uygular", () => {
    expect(rejects("ab")).toBe("cok-kisa");
    expect(ok("abc")).toBe("abc");
    expect(ok("a".repeat(DISPLAY_NAME_MAX_LENGTH))).toHaveLength(
      DISPLAY_NAME_MAX_LENGTH,
    );
    expect(rejects("a".repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toBe("cok-uzun");
  });

  /**
   * BU TESTİ YAZARKEN BİR KUSUR BULUNDU. "é" iki biçimde yazılabilir: tek
   * kod noktası (U+00E9) ya da `e` + birleşik aksan (U+0301). İkisi ekranda
   * aynıdır ama hangisinin geldiği kullanıcının klavyesine bağlıdır. Beyaz
   * liste birleşik işaretleri kapsamıyor, yani AYRIŞIK yazan kullanıcı kendi
   * göremediği bir sebeple reddediliyordu. Onarım: girdi NFC'ye
   * normalleştiriliyor.
   */
  it("AYRIŞIK yazılmış aksanı kabul eder ve birleştirir", () => {
    const ayrisik = "José";
    const birlesik = "José";

    expect(ok(ayrisik)).toBe(birlesik);
    // Uzunluk da kararlı olmalı: iki biçim aynı sayıda karakter saymalı.
    expect([...ok(ayrisik)]).toHaveLength(4);
  });

  it("iki biçim AYNI adı verir — tabloda iki satır olmaz", () => {
    expect(displayNameKey(ok("José"))).toBe(displayNameKey(ok("José")));
  });

  it("harf taşımayan adı reddeder", () => {
    expect(rejects("123")).toBe("harf-yok");
    expect(rejects("---")).toBe("harf-yok");
    expect(rejects("__ 42")).toBe("harf-yok");
  });
});

/**
 * TAKLİT YÜZEYİ. Beyaz liste bu ailenin tamamını tek kuralla kapatır; kara
 * liste her birini tek tek saymak zorunda kalır ve birini kaçırır.
 */
describe("validateDisplayName — taklit ve görünmez karakterler", () => {
  it("KİRİL homoglifini reddeder", () => {
    // "Мehmet" — baştaki M Kiril U+041C. Ekranda Latin M'den ayırt edilemez.
    expect(rejects("Мehmet")).toBe("gecersiz-karakter");
  });

  it("YUNAN homoglifini reddeder", () => {
    // Yunan Omicron U+039F, Latin O gibi görünür.
    expect(rejects("KΟray")).toBe("gecersiz-karakter");
  });

  it("sıfır genişlikli karakteri reddeder", () => {
    // Gözle görünmez; "Mehmet" ile aynı görünen ikinci bir ad üretir.
    expect(rejects("Meh​met")).toBe("gecersiz-karakter");
  });

  it("yön değiştirme işaretini reddeder", () => {
    // U+202E metni ters gösterir; adın ekranda başka bir şey okunmasını sağlar.
    expect(rejects("Meh‮met")).toBe("gecersiz-karakter");
  });

  it("emoji reddedilir — bilinen ve kabul edilen bedel", () => {
    expect(rejects("Mehmet⚽")).toBe("gecersiz-karakter");
  });

  it("noktalama ve biçimlendirme reddedilir", () => {
    expect(rejects("<b>Mehmet</b>")).toBe("gecersiz-karakter");
    expect(rejects("Mehmet!")).toBe("gecersiz-karakter");
    expect(rejects("a@b.com")).toBe("gecersiz-karakter");
  });
});

describe("validateDisplayName — ayrılmış adlar", () => {
  it("yetki taklidi eden adları reddeder", () => {
    expect(rejects("admin")).toBe("ayrilmis");
    expect(rejects("Moderator")).toBe("ayrilmis");
    expect(rejects("SİSTEM")).toBe("ayrilmis");
  });

  it("büyük/küçük harf ve aksan farkı kapıyı AŞMAZ", () => {
    expect(rejects("AdMiN")).toBe("ayrilmis");
    expect(rejects("Fütbol Quiz")).toBe("ayrilmis");
  });

  /**
   * SIRA ÖNEMLİ: biçim denetimi ayrılmış ad denetiminden ÖNCE gelir. Aksi
   * hâlde "Admin!!!" yazan kullanıcı "bu ad ayrılmış" duyardı ve bu, hangi
   * adların ayrıldığını sızdırırdı.
   */
  it("geçersiz karakterli ayrılmış ad, BİÇİM gerekçesiyle reddedilir", () => {
    expect(rejects("Admin!!!")).toBe("gecersiz-karakter");
  });
});

describe("displayNameKey — tekillik", () => {
  it("büyük/küçük harf farkı aynı anahtarı verir", () => {
    expect(displayNameKey("Mehmet")).toBe(displayNameKey("MEHMET"));
  });

  it("Türkçe ı/İ tuzağı anahtarı bölmez", () => {
    // `toSearchKey` bu iki tuzağı zaten çözüyor; burada yeniden kullanılıyor.
    expect(displayNameKey("İbrahim")).toBe(displayNameKey("ibrahim"));
    expect(displayNameKey("Işık")).toBe(displayNameKey("isik"));
  });

  it("aksan farkı anahtarı bölmez", () => {
    expect(displayNameKey("Şükrü")).toBe(displayNameKey("Sukru"));
  });

  it("ayraç farkı anahtarı bölmez", () => {
    // "Ali_Can", "Ali-Can" ve "Ali Can" tabloda ayırt edilemez; aynı ad sayılır.
    expect(displayNameKey("Ali_Can")).toBe(displayNameKey("Ali Can"));
    expect(displayNameKey("Ali-Can")).toBe(displayNameKey("Ali Can"));
  });

  it("farklı adlar farklı anahtar verir", () => {
    expect(displayNameKey("Mehmet")).not.toBe(displayNameKey("Ahmet"));
  });

  it("doğrulama, kullanılacak anahtarı BİRLİKTE döner", () => {
    const result = validateDisplayName("  Ali   Can  ");
    expect(result.ok && result.value).toBe("Ali Can");
    expect(result.ok && result.key).toBe(displayNameKey("Ali Can"));
  });
});

describe("displayNameRejectionMessage", () => {
  it("her gerekçe için metin vardır", () => {
    const reasons: DisplayNameRejection[] = [
      "bos",
      "cok-kisa",
      "cok-uzun",
      "gecersiz-karakter",
      "harf-yok",
      "ayrilmis",
    ];

    for (const reason of reasons) {
      expect(displayNameRejectionMessage(reason).length).toBeGreaterThan(0);
    }
  });

  it("sınır metinleri sabitlerle tutarlıdır", () => {
    // Sabit değişince metin sessizce yanlış kalmasın.
    expect(displayNameRejectionMessage("cok-kisa")).toContain(
      String(DISPLAY_NAME_MIN_LENGTH),
    );
    expect(displayNameRejectionMessage("cok-uzun")).toContain(
      String(DISPLAY_NAME_MAX_LENGTH),
    );
  });
});
