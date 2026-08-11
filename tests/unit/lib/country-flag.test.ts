import { describe, expect, it } from "vitest";
import { availableFlagCodes, flagCodeFor, flagUrl } from "@/lib/country-flag";

/** BR-39 — lig bayrağı eşlemesi (§7.14). */

describe("flagCodeFor", () => {
  it("ülke kodunu küçük harfe indirip kullanır", () => {
    expect(flagCodeFor({ wikidataId: "Q1", country: "TR" })).toBe("tr");
    expect(flagCodeFor({ wikidataId: "Q2", country: "IT" })).toBe("it");
  });

  /**
   * ÖLÇÜLMÜŞ KUSUR (§7.14). Veride Premier League ile İskoçya Premier Ligi
   * aynı ülke kodunu (`GB`) taşıyor. Aynı bayrak basılsaydı iki lig ayırt
   * edilemezdi — yani bayrak, konulma sebebini yerine getirmezdi.
   */
  it("iki İngiliz ligini AYRI bayraklara ayırır", () => {
    const premier = flagCodeFor({ wikidataId: "Q9448", country: "GB" });
    const iskocya = flagCodeFor({ wikidataId: "Q14377162", country: "GB" });

    expect(premier).toBe("gb-eng");
    expect(iskocya).toBe("gb-sct");
    expect(premier).not.toBe(iskocya);
  });

  it("istisna ÜLKEYE değil LİGE bağlıdır", () => {
    // `GB` kodunun kendisi doğru; yanlış olan onu tek bayrağa eşlemek.
    // İstisna listesinde olmayan bir GB ligi Birleşik Krallık bayrağı alır.
    expect(flagCodeFor({ wikidataId: "Q_baska", country: "GB" })).toBe("gb");
  });

  it("dosyası olmayan ülke için `null` verir", () => {
    // Olmayan bir dosyaya `src` vermek kırık görsel simgesi gösterirdi ve bu,
    // boş yuvadan kötüdür (§7.13).
    expect(flagCodeFor({ wikidataId: "Q1", country: "JP" })).toBeNull();
    expect(flagCodeFor({ wikidataId: "Q1", country: "" })).toBeNull();
  });

  it("boşluklu kodu tolere eder", () => {
    expect(flagCodeFor({ wikidataId: "Q1", country: " tr " })).toBe("tr");
  });
});

describe("flagUrl", () => {
  it("herkese açık yolu verir", () => {
    expect(flagUrl("tr")).toBe("/flags/tr.svg");
    expect(flagUrl("gb-sct")).toBe("/flags/gb-sct.svg");
  });
});

describe("availableFlagCodes", () => {
  it("istisna kodlarını da içerir", () => {
    const codes = availableFlagCodes();

    expect(codes).toContain("gb-eng");
    expect(codes).toContain("gb-sct");
    // Sade `gb` de duruyor: istisna listesinde olmayan bir GB ligi gelirse
    // bayraksız kalmasın.
    expect(codes).toContain("gb");
  });
});
