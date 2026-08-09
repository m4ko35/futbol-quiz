import { describe, expect, it } from "vitest";
import {
  classifyLocalFile,
  cleanAuthor,
  commonsFilePage,
  extractCrestFile,
  fileNameFromCrestUrl,
  fileNameFromValue,
  findClubInfobox,
  isPlausibleCrest,
  isUsableFile,
  toAttribution,
  type FileMetadata,
  type LocalFileMetadata,
} from "../../../scripts/etl/pipeline/crest-source";

/** §4.3.1 — arma çıkarımı ve lisans sınıflandırması (BR-33, BR-34). */

const FREE: FileMetadata = {
  existsOnCommons: true,
  licenseShortName: "Public domain",
  artist: "Kulüp",
  attributionRequired: false,
  nonFree: false,
};

describe("extractCrestFile", () => {
  it("kulüp bilgi kutusundaki armayı bulur", () => {
    const wikitext = `
      {{Infobox football club
      | clubname = Ajax
      | logo = [[File:Ajax Amsterdam.svg|150px]]
      | founded = 1900
      }}
      Metin.`;

    expect(extractCrestFile(wikitext)).toBe("Ajax Amsterdam.svg");
  });

  /**
   * ÖLÇÜLMÜŞ HATA (§4.3.1): sayfanın ilk görselini almak Aberdeen'de tribün
   * fotoğrafı, Pasching'de stadyum fotoğrafı veriyordu. Adlandırılmış alan
   * (`logo`) genel alandan (`image`) ÖNCE sorulur.
   */
  it("'logo' alanını 'image' alanına TERCİH eder", () => {
    const wikitext = `
      {{Infobox football club
      | image = [[File:Stadium aerial.jpg|300px]]
      | logo = [[File:Club crest.svg]]
      }}`;

    expect(extractCrestFile(wikitext)).toBe("Club crest.svg");
  });

  it("bilgi kutusu yoksa null döner — makale gövdesi TARANMAZ", () => {
    // Gövdede geçen bir dosya arma sanılırsa yanlış görsel gösterilir; boş
    // arma buna yeğdir (§2.7).
    const wikitext = `
      Kulübün stadyumu şuradadır.
      [[File:Some stadium.jpg|thumb|Stadyum]]`;

    expect(extractCrestFile(wikitext)).toBeNull();
  });

  it("beş dilin şablon adlarını da tanır", () => {
    for (const name of [
      "Futbol kulübü bilgi kutusu",
      "Infobox società calcistica",
      "Infobox Fußballklub",
      "Infobox Club de football",
    ]) {
      const wikitext = `{{${name}\n| logo = Test logo.svg\n}}`;
      expect(extractCrestFile(wikitext), name).toBe("Test logo.svg");
    }
  });

  it("iç içe şablonlarda kutunun sonunu doğru bulur", () => {
    const wikitext = `
      {{Infobox football club
      | clubname = {{nobr|Test {{small|FC}}}}
      | logo = Nested.svg
      }}`;

    expect(extractCrestFile(wikitext)).toBe("Nested.svg");
  });
});

describe("fileNameFromValue", () => {
  it("bağlantılı, önekli ve düz yazımı çözer", () => {
    expect(fileNameFromValue("[[Dosya:Arma.svg|100px]]")).toBe("Arma.svg");
    expect(fileNameFromValue("File:Arma.png")).toBe("Arma.png");
    expect(fileNameFromValue("  Arma_2.jpg ")).toBe("Arma 2.jpg");
  });

  it("görsel olmayan ve şablon kalıntılı değerleri reddeder", () => {
    expect(fileNameFromValue("yes")).toBeNull();
    expect(fileNameFromValue("")).toBeNull();
    // Şablon kalıntısı taşıyan değer güvenilir değil; UYDURULMAZ.
    expect(fileNameFromValue("{{#if:x|Arma.svg}}")).toBeNull();
  });
});

describe("BR-33 — yalnızca Commons", () => {
  it("Commons'ta olmayan dosya kullanılmaz", () => {
    // Yerel dosya ya adil kullanımdır ya da yalnızca ABD'de özgürdür; ikisi de
    // dünyaya açık bir sitede kullanılamaz (§4.3.1).
    expect(isUsableFile({ ...FREE, existsOnCommons: false })).toBe(false);
  });

  it("NonFree işaretli dosya kullanılmaz", () => {
    expect(isUsableFile({ ...FREE, nonFree: true })).toBe(false);
  });

  it("Commons'taki özgür dosya kullanılır", () => {
    expect(isUsableFile(FREE)).toBe(true);
  });
});

describe("BR-34 — atıf künyesi", () => {
  it("lisans yoksa künye üretilmez", () => {
    expect(
      toAttribution("X.svg", { ...FREE, licenseShortName: null }),
    ).toBeNull();
  });

  it("atıf ZORUNLUYSA yazarsız künye üretilmez", () => {
    // Eksik atıfla göstermek lisansın tek koşulunu çiğnemek olurdu.
    expect(
      toAttribution("X.svg", {
        ...FREE,
        licenseShortName: "CC BY-SA 4.0",
        attributionRequired: true,
        artist: null,
      }),
    ).toBeNull();
  });

  it("kamu malı dosyada yazar olmadan da künye üretilir", () => {
    const attribution = toAttribution("X.svg", { ...FREE, artist: null });

    expect(attribution?.license).toBe("Public domain");
    expect(attribution?.author).toBeNull();
  });

  it("dosya sayfası Commons adresine çözülür", () => {
    expect(commonsFilePage("Logo of AC Milan.svg")).toBe(
      "https://commons.wikimedia.org/wiki/File:Logo_of_AC_Milan.svg",
    );
  });
});

describe("cleanAuthor", () => {
  it("HTML etiketlerini ve varlıkları söker", () => {
    expect(cleanAuthor('<p><a href="/wiki/X">Ilya Khokhlov</a>\n</p>')).toBe(
      "Ilya Khokhlov",
    );
    expect(cleanAuthor("Peter Gribat &amp; 1. FC Union Berlin e.V.")).toBe(
      "Peter Gribat & 1. FC Union Berlin e.V.",
    );
  });

  it("boş künyeyi null yapar", () => {
    expect(cleanAuthor(null)).toBeNull();
    expect(cleanAuthor("<p> </p>")).toBeNull();
  });

  it("lisans metni uzunluğundaki künyeyi kırpar", () => {
    // Bazı dosyalarda `Artist` alanı bir yazar adı değil, tam lisans metni.
    const long = "A".repeat(400);
    expect(cleanAuthor(long)?.length).toBe(118);
  });
});

describe("isPlausibleCrest — §4.3.1", () => {
  it("arma sözcüğü geçen dosyayı kabul eder", () => {
    expect(isPlausibleCrest("BesiktasJK-Logo.svg", "Beşiktaş")).toBe(true);
    // Sıkışık yazımda da: sınır şartı bunları elerdi.
    expect(isPlausibleCrest("BaltykaFCLogo2018.png", "Baltika")).toBe(true);
  });

  it("kulüp adıyla ortak belirteç taşıyan dosyayı kabul eder", () => {
    expect(isPlausibleCrest("Galatasaray 1905.svg", "Galatasaray")).toBe(true);
  });

  /** Ölçülmüş hata: bilgi kutusunun genel `image` alanı ve kategori gürültüsü. */
  it("arma OLMAYAN dosyaları eler", () => {
    expect(isPlausibleCrest("Stadion Na Litavce2.jpg", "1. FK Příbram")).toBe(
      false,
    );
    expect(
      isPlausibleCrest(
        "Kit socks newbalancefootballbluelogo.png",
        "Athletic Bilbao",
      ),
    ).toBe(false);
    expect(
      isPlausibleCrest("IMG Logo del Trofeo Gigi Riva.jpg", "Cagliari"),
    ).toBe(false);
    expect(
      isPlausibleCrest("Coat of arms of the Duchy of Savoy.svg", "A.C. Savoia"),
    ).toBe(false);
  });

  /**
   * KISA SÖZCÜKLER SINIR İSTER. İkisi de veritabanına yazılmıştı: `arma`
   * sınırsızken "Alf F-arma-n" bir oyuncu portresiydi, `badge` sınırsızken
   * "Billy the B-adge-r" Fulham'ın maskotu.
   */
  it("kelime İÇİNDE geçen kısa sözcüğe kanmaz", () => {
    expect(isPlausibleCrest("Alf Farman.jpg", "Bolton Wanderers")).toBe(false);
    expect(
      isPlausibleCrest("Billy the Badger 04012026 (1).jpg", "Fulham"),
    ).toBe(false);
  });

  it("genel sözcükler ortak belirteç SAYILMAZ", () => {
    // "Football"/"Club" neredeyse her kulüpte geçer; eşleşme sayılsaydı süzgeç
    // hiçbir şey elemezdi.
    expect(isPlausibleCrest("Some football club photo.jpg", "Real Club")).toBe(
      false,
    );
  });
});

describe("fileNameFromCrestUrl", () => {
  it("SVG ve küçük resim adreslerini geri çözer", () => {
    expect(
      fileNameFromCrestUrl(
        "https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg",
      ),
    ).toBe("Logo of AC Milan.svg");

    expect(
      fileNameFromCrestUrl(
        "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.png/120px-X.png",
      ),
    ).toBe("X.png");
  });

  it("Commons dışı adreste null döner", () => {
    expect(
      fileNameFromCrestUrl(
        "https://upload.wikimedia.org/wikipedia/tr/a/ab/Y.png",
      ),
    ).toBeNull();
  });
});

describe("classifyLocalFile — §4.3.1 denetimi", () => {
  const LOCAL: LocalFileMetadata = {
    exists: true,
    onCommons: false,
    licenseShortName: null,
    license: null,
    usageTerms: null,
    artist: null,
    attributionRequired: false,
    nonFree: false,
    copyrighted: null,
    restrictions: null,
  };

  it("Commons'ta çıkan dosyayı ret sebebi saymaz", () => {
    // `imagerepository: shared` bizim arama hatamızdır, dosyanın kusuru değil.
    expect(classifyLocalFile({ ...LOCAL, onCommons: true })).toBe("commons");
  });

  it("NonFree işaretini adil kullanım sayar", () => {
    expect(classifyLocalFile({ ...LOCAL, nonFree: true })).toBe(
      "adil-kullanım",
    );
  });

  it("adil kullanım, ABD kısıtından AĞIR basar", () => {
    // İkisi birden işaretliyse dosya zaten telifli; hafif olanı raporlamak
    // durumu olduğundan iyi gösterirdi.
    expect(
      classifyLocalFile({
        ...LOCAL,
        nonFree: true,
        licenseShortName: "Public domain in the United States",
      }),
    ).toBe("adil-kullanım");
  });

  it("künyede AÇIKÇA yazan ABD kısıtını yakalar", () => {
    expect(
      classifyLocalFile({
        ...LOCAL,
        licenseShortName: "Public domain in the United States",
      }),
    ).toBe("yalnızca-ABD");
    expect(
      classifyLocalFile({ ...LOCAL, usageTerms: "PD-ineligible-USonly" }),
    ).toBe("yalnızca-ABD");
  });

  /**
   * BU TESTİN SEBEBİ ÖLÇÜLMÜŞ BİR HATA.
   *
   * Bu künye ile dünya çapında kamu malı olan bir dosyanınki AYNI. Ölçüldü:
   * bu kovaya düşen 7 dosyanın 5'i `{{PD-ineligible-USonly}}` çıktı — yani
   * künyeye bakıp "özgür" demek 5 telifli dosyayı siteye sokardı.
   */
  it("özgür GÖRÜNEN künyeyi özgür İLAN ETMEZ", () => {
    const verdict = classifyLocalFile({
      ...LOCAL,
      license: "pd",
      licenseShortName: "PD",
      usageTerms: "Public domain",
      copyrighted: "False",
    });

    expect(verdict).toBe("özgür-görünüyor");
    // Kova adı "özgür" OLMAMALI: bu değer doğrudan kullanıma yol açamaz.
    expect(verdict).not.toBe("özgür");
  });

  it("tanımadığı künyeyi özgür saymaz", () => {
    // Almanca `Bild-LogoSH` ve Fransızca `marque déposée` buraya düşer.
    expect(
      classifyLocalFile({
        ...LOCAL,
        licenseShortName: "Logo",
        copyrighted: "True",
      }),
    ).toBe("belirsiz");
    expect(
      classifyLocalFile({ ...LOCAL, licenseShortName: "marque déposée" }),
    ).toBe("belirsiz");
  });

  it("yerel vikide de olmayan dosyayı ayırır", () => {
    expect(classifyLocalFile({ ...LOCAL, exists: false })).toBe("yok");
  });
});

describe("findClubInfobox", () => {
  it("oyuncu bilgi kutusunu kulüp kutusu sanmaz", () => {
    // `infobox.ts` oyuncu kutularını arıyor; iki liste bilerek ayrı (§4.3.1).
    const wikitext =
      "{{Infobox football biography\n| name = X\n| image = Y.jpg\n}}";

    expect(findClubInfobox(wikitext)).toBeNull();
  });
});
