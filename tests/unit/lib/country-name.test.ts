import { describe, expect, it } from "vitest";
import { countryName } from "@/lib/country-name";

/** §1.2 — arayüz Türkçedir; ham ISO kodu kullanıcıya bir şey söylemez. */

describe("countryName", () => {
  it("yaygın kodları Türkçeye çevirir", () => {
    expect(countryName("TR")).toBe("Türkiye");
    expect(countryName("DE")).toBe("Almanya");
    expect(countryName("GB")).toBe("Birleşik Krallık");
    expect(countryName("BR")).toBe("Brezilya");
  });

  /**
   * İki bilinçli sapma. CLDR "Amerika Birleşik Devletleri" ve "Côte d'Ivoire"
   * verir; ilki ızgara başlığında üç satıra sarar, ikincisi Türkçede yerleşik
   * olmayan endonimdir.
   */
  it("bilinçli sapmaları uygular", () => {
    expect(countryName("US")).toBe("ABD");
    expect(countryName("CI")).toBe("Fildişi Sahili");
  });

  /**
   * Kod çözülemezse boş etiket değil, KODUN KENDİSİ gösterilir.
   *
   * "QQ"/"AA" ISO'da atanmamıştır — `Intl` girdiyi geri verir. "XX1" ve boş
   * dize ise biçimsizdir ve `RangeError` fırlatır; ikisi de aynı sonuca
   * varmalı, çünkü kullanıcı açısından fark yok.
   */
  it("tanınmayan kodu olduğu gibi döner", () => {
    expect(countryName("QQ")).toBe("QQ");
    expect(countryName("XX1")).toBe("XX1");
    expect(countryName("")).toBe("");
  });

  /**
   * `Intl` küçük harfli kodu SESSİZCE çözmez, girdiyi geri verir. ETL şu an
   * kodları büyütüyor; bu davranışa bel bağlamak, ileride başka bir kaynak
   * eklendiğinde ekranda "it" yazmasına yol açardı.
   */
  it("küçük harfli kodu da çözer", () => {
    expect(countryName("tr")).toBe("Türkiye");
    expect(countryName("us")).toBe("ABD");
  });

  it("aynı kod her çağrıda aynı adı verir", () => {
    expect(countryName("IT")).toBe(countryName("IT"));
  });
});
