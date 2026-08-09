import { describe, expect, it } from "vitest";
import { clubInitials } from "@/lib/club-initials";

/** §7.13 — kulüp işaretinin baş harfleri (BR-35). */

describe("clubInitials", () => {
  /**
   * İKİ SÖZCÜKTE İLK SÖZCÜKTEN İKİ HARF — ölçümle seçilmiş varyant.
   *
   * Her sözcükten birer harf almak (`Swansea City` → `SC`, `Stoke City` → `SC`)
   * çakışmayı armasız 510 kulübün %27,3'ünde bırakıyordu. Ayırt eden bilgi
   * neredeyse her zaman BİRİNCİ sözcüktedir; ikincisi çoğu adda ortaktır
   * ("City", "United", "Rovers"). Bu kural payı %14,5'e indiriyor.
   */
  it("iki sözcüklü adda ilk sözcükten iki, ikinciden bir harf alır", () => {
    expect(clubInitials("Manchester United")).toBe("MAU");
    expect(clubInitials("Hellas Verona")).toBe("HEV");
    expect(clubInitials("Borussia Dortmund")).toBe("BOD");
  });

  it("aynı ikinci sözcüğü taşıyan kulüpleri AYIRIR", () => {
    // Eski kuralda ikisi de `SC` idi; işaret ayırt edici olmaktan çıkmıştı.
    expect(clubInitials("Swansea City")).toBe("SWC");
    expect(clubInitials("Stoke City")).toBe("STC");
    expect(clubInitials("Swansea City")).not.toBe(clubInitials("Stoke City"));
  });

  it("üç ve daha fazla sözcükte her birinden bir harf alır", () => {
    expect(clubInitials("Al-Shabab Riyad")).toBe("ASR");
    expect(clubInitials("Club Atletic Oradea")).toBe("CAO");
  });

  it("tek sözcüklü addan ilk üç harfi alır", () => {
    expect(clubInitials("Everton")).toBe("EVE");
    expect(clubInitials("Galatasaray")).toBe("GAL");
  });

  /**
   * NOKTALI KISALTMALAR BİRLEŞTİRİLİR — ölçümde çıkan kusur.
   *
   * "A.C. Carpi" ayrıştırıcıda `A` + `C` + `Carpi` olarak üç sözcüğe
   * bölünüyordu; ne `A` ne `C` tür listesinde olduğu için ikisi de ayırt edici
   * sayılıyor ve sonuç `ACC` çıkıyordu. Birleştirilince tür listesi işini
   * görüyor.
   */
  it("noktalı tür kısaltmasını birleştirip atar", () => {
    expect(clubInitials("A.C. Carpi")).toBe("CAR");
    expect(clubInitials("A.C. Savoia")).toBe("SAV");
    expect(clubInitials("A.C. Carpi")).not.toBe(clubInitials("A.C. Savoia"));
  });

  /**
   * BÜYÜK HARF KURALI ÜLKEYE BAĞLI — ölçümle bulunmuş tuzak.
   *
   * `"i".toUpperCase()` `"I"` verir, Türkçe için yanlış. Ama düzeltmeyi her
   * ada uygulamak `AC Milan` işaretini `Mİ` yapıyordu; 906 kulübün 41'i için
   * doğru olan kural kalan 865'i bozuyordu.
   */
  it("Türk kulüplerinde noktalı İ üretir", () => {
    expect(clubInitials("Sivasspor", "TR")).toBe("SİV");
    expect(clubInitials("İstanbulspor", "TR")).toBe("İST");
    expect(clubInitials("Ümraniyespor", "TR")).toBe("ÜMR");
  });

  it("yabancı kulüplerde noktasız I üretir", () => {
    expect(clubInitials("AC Milan", "IT")).toBe("MIL");
    expect(clubInitials("Inter", "IT")).toBe("INT");
    expect(clubInitials("Liverpool", "GB")).toBe("LIV");
  });

  it("ülke bilinmiyorsa noktasız I'ya düşer", () => {
    // Çoğunluk yabancı; bilinmeyende çoğunluğun kuralı uygulanır.
    expect(clubInitials("Milan")).toBe("MIL");
    expect(clubInitials("Milan", null)).toBe("MIL");
  });

  it("kaynakta zaten büyük olan İ her iki yolda da korunur", () => {
    expect(clubInitials("İstanbul Başakşehir", "TR")).toBe("İSB");
    expect(clubInitials("İstanbul Başakşehir")).toBe("İSB");
  });

  it("kulüp TÜRÜ kısaltmalarını atar", () => {
    // "Genoa CFC" → GEC olsaydı işaret kulübü değil, kulüp türünü hecelerdi.
    expect(clubInitials("Genoa CFC")).toBe("GEN");
    expect(clubInitials("AC Milan")).toBe("MIL");
    expect(clubInitials("AS Roma")).toBe("ROM");
    expect(clubInitials("FC Bayern München")).toBe("BAM");
  });

  it("İskandinav tür eklerini de atar", () => {
    // 906 kulüplük süpürmede yakalandı: bunlar atılmazsa işaret adın değil,
    // kulüp türünün harfini alıyor (`Gefle IF` → `GEI`).
    expect(clubInitials("Gefle IF", "SE")).toBe("GEF");
    expect(clubInitials("Mjällby AIF", "SE")).toBe("MJÄ");
    expect(clubInitials("Malmö FF", "SE")).toBe("MAL");
  });

  it("adın KENDİSİ olan kısaltmaları atmaz", () => {
    // Liste kısa tutuldu: bunlar tür bildirimi değil, kulüp adı.
    expect(clubInitials("AEK Athens")).toBe("AEA");
    expect(clubInitials("PSV Eindhoven")).toBe("PSE");
    // `IFK` tam sözcük eşleşmesi sayesinde `IF` kuralına takılmaz.
    expect(clubInitials("IFK Göteborg")).toBe("IFG");
  });

  it("sıra numarasını ve parantezli eki atar", () => {
    expect(clubInitials("1. FK Příbram")).toBe("PŘÍ");
    expect(clubInitials("FC Karpaty Lviv (2020)")).toBe("KAL");
    // Parantez ayırt edici olmadığı için iki kayıt aynı işareti alır.
    expect(clubInitials("FC Karpaty Lviv")).toBe("KAL");
  });

  it("noktalama ve tireyi sözcük sınırı sayar", () => {
    expect(clubInitials("Bodø/Glimt")).toBe("BOG");
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

  it("üç harften uzun işaret ÜRETMEZ", () => {
    // Karo sabit ölçüde; dördüncü harf taşar. Kural her dalda en çok üç
    // karakter vermeli — tek sözcük, iki sözcük ve çok sözcük dâhil.
    for (const name of [
      "Manchester United",
      "Galatasaray",
      "Club Atletic Oradea",
      "Association Sportive de Saint-Étienne Loire",
      "A.C. Carpi",
    ]) {
      expect(clubInitials(name).length).toBeLessThanOrEqual(3);
    }
  });
});
