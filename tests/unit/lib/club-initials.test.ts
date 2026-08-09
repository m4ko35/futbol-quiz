import { describe, expect, it } from "vitest";
import { clubInitials } from "@/lib/club-initials";

/** §7.13 — kulüp işaretinin baş harfleri (BR-35). */

describe("clubInitials", () => {
  it("iki sözcüklü addan her sözcüğün baş harfini alır", () => {
    expect(clubInitials("Manchester United")).toBe("MU");
    expect(clubInitials("Hellas Verona")).toBe("HV");
    expect(clubInitials("Borussia Dortmund")).toBe("BD");
  });

  it("tek sözcüklü addan ilk iki harfi alır", () => {
    expect(clubInitials("Everton")).toBe("EV");
    expect(clubInitials("Galatasaray")).toBe("GA");
  });

  /**
   * BÜYÜK HARF KURALI ÜLKEYE BAĞLI — ölçümle bulunmuş tuzak.
   *
   * `"i".toUpperCase()` `"I"` verir, Türkçe için yanlış. Ama düzeltmeyi her
   * ada uygulamak `AC Milan` işaretini `Mİ` yapıyordu; 906 kulübün 41'i için
   * doğru olan kural kalan 865'i bozuyordu.
   */
  it("Türk kulüplerinde noktalı İ üretir", () => {
    expect(clubInitials("Sivasspor", "TR")).toBe("Sİ");
    expect(clubInitials("İstanbulspor", "TR")).toBe("İS");
    expect(clubInitials("Ümraniyespor", "TR")).toBe("ÜM");
  });

  it("yabancı kulüplerde noktasız I üretir", () => {
    expect(clubInitials("AC Milan", "IT")).toBe("MI");
    expect(clubInitials("Inter", "IT")).toBe("IN");
    expect(clubInitials("Liverpool", "GB")).toBe("LI");
  });

  it("ülke bilinmiyorsa noktasız I'ya düşer", () => {
    // Çoğunluk yabancı; bilinmeyende çoğunluğun kuralı uygulanır.
    expect(clubInitials("Milan")).toBe("MI");
    expect(clubInitials("Milan", null)).toBe("MI");
  });

  it("kaynakta zaten büyük olan İ her iki yolda da korunur", () => {
    expect(clubInitials("İstanbul Başakşehir", "TR")).toBe("İB");
    expect(clubInitials("İstanbul Başakşehir")).toBe("İB");
  });

  it("kulüp TÜRÜ kısaltmalarını atar", () => {
    // "Genoa CFC" → GC olsaydı işaret kulübü değil, kulüp türünü hecelerdi.
    expect(clubInitials("Genoa CFC")).toBe("GE");
    expect(clubInitials("AC Milan")).toBe("MI");
    expect(clubInitials("AS Roma")).toBe("RO");
    expect(clubInitials("FC Bayern München")).toBe("BM");
  });

  it("İskandinav tür eklerini de atar", () => {
    // 906 kulüplük süpürmede yakalandı: bunlar atılmazsa işaret adın değil,
    // kulüp türünün harfini alıyor (`Gefle IF` → `GI`).
    expect(clubInitials("Gefle IF", "SE")).toBe("GE");
    expect(clubInitials("Mjällby AIF", "SE")).toBe("MJ");
    expect(clubInitials("Malmö FF", "SE")).toBe("MA");
  });

  it("adın KENDİSİ olan kısaltmaları atmaz", () => {
    // Liste kısa tutuldu: bunlar tür bildirimi değil, kulüp adı.
    expect(clubInitials("AEK Athens")).toBe("AA");
    expect(clubInitials("PSV Eindhoven")).toBe("PE");
    // `IFK` tam sözcük eşleşmesi sayesinde `IF` kuralına takılmaz.
    expect(clubInitials("IFK Göteborg")).toBe("IG");
  });

  it("sıra numarasını ve parantezli eki atar", () => {
    expect(clubInitials("1. FK Příbram")).toBe("PŘ");
    expect(clubInitials("FC Karpaty Lviv (2020)")).toBe("KL");
    // Parantez ayırt edici olmadığı için iki kayıt aynı işareti alır.
    expect(clubInitials("FC Karpaty Lviv")).toBe("KL");
  });

  it("noktalama ve tireyi sözcük sınırı sayar", () => {
    expect(clubInitials("Al-Shabab Riyad")).toBe("AS");
    expect(clubInitials("Bodø/Glimt")).toBe("BG");
  });

  /**
   * ASLA BOŞ DÖNMEZ. Çağıran taraf ayrıca boş durum düşünmek zorunda kalırsa
   * o dal er ya da geç atlanır ve yuva yeniden boşalır — BR-35'in önlemek
   * istediği şey tam olarak bu.
   */
  it("bozuk adlarda bile bir işaret üretir", () => {
    expect(clubInitials("")).toBe("?");
    expect(clubInitials("   ")).toBe("?");
    expect(clubInitials("FC")).toBe("FC");
    expect(clubInitials("A")).toBe("A");
  });
});
