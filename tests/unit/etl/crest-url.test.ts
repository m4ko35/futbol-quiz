import { describe, expect, it } from "vitest";
import { toCommonsFileUrl } from "../../../scripts/etl/pipeline/crest-url";

const UPLOAD = "https://upload.wikimedia.org/wikipedia/commons";
const filePath = (name: string) =>
  `http://commons.wikimedia.org/wiki/Special:FilePath/${name}`;

/**
 * Beklenen çıktılar Commons'ın CANLI adreslerinden alındı (§7.3). Sabit
 * değerler burada bilerek elle yazılı: fonksiyonun kendi hesabını kendisine
 * doğrulatmak hiçbir şey kanıtlamazdı.
 */
describe("toCommonsFileUrl", () => {
  it("SVG armayı doğrudan upload adresine çevirir", () => {
    expect(toCommonsFileUrl(filePath("Logo%20of%20AC%20Milan.svg"))).toBe(
      `${UPLOAD}/d/d0/Logo_of_AC_Milan.svg`,
    );
  });

  it("raster armayı küçük resim adresine çevirir", () => {
    // 1899 Hoffenheim — tam boyu 172 KB, 120 px'lik küçük resmi 15 KB. Seçim
    // listesinde onlarca arma inerken fark belirleyici (§1.4 LCP hedefi).
    expect(toCommonsFileUrl(filePath("TSG%20Logo-Standard%204c.png"))).toBe(
      `${UPLOAD}/thumb/6/64/TSG_Logo-Standard_4c.png/120px-TSG_Logo-Standard_4c.png`,
    );
  });

  it("genişlik Wikimedia'nın İZİN VERDİĞİ değerlerden biridir", () => {
    // Ölçüldü: 96 px kullanan ilk sürümde 114 adresin TAMAMI 400 döndü.
    // Wikimedia keyfi genişlik kabul etmiyor; 120 ve 250 çalışıyor.
    const url = toCommonsFileUrl(filePath("Foo.png")) ?? "";
    const width = Number(/\/(\d+)px-/u.exec(url)?.[1]);

    expect([120, 250]).toContain(width);
  });

  it("ASCII dışı karakterleri koruyarak kodlar", () => {
    // "1. FC Nürnberg logo.svg" → boşluklar alt çizgi olur, "ü" yeniden
    // kodlanır. MD5 KODLANMAMIŞ ada göre hesaplanır; sıra karışırsa dizin
    // yanlış çıkar ve adres 404 döner.
    expect(
      toCommonsFileUrl(filePath("1.%20FC%20N%C3%BCrnberg%20logo.svg")),
    ).toBe(`${UPLOAD}/f/fa/1._FC_N%C3%BCrnberg_logo.svg`);
  });

  it("çıktı her zaman CSP beyaz listesindeki köken ve şema ile başlar", () => {
    for (const name of [
      "Logo%20of%20AC%20Milan.svg",
      "TSG%20Logo-Standard%204c.png",
      "Foo.JPG",
    ]) {
      const url = toCommonsFileUrl(filePath(name));
      expect(url).toMatch(/^https:\/\/upload\.wikimedia\.org\//u);
    }
  });

  it.each([
    ["null girdi", null],
    ["Special:FilePath içermeyen adres", "https://example.com/logo.png"],
    ["dosya adı boş", filePath("")],
    ["bozuk yüzde kodlaması", filePath("%E0%A4%A")],
    ["dosya adında dizin ayracı", filePath("a%2Fb.svg")],
  ])("beklenmeyen girdide `null` döner: %s", (_label, raw) => {
    expect(toCommonsFileUrl(raw)).toBeNull();
  });

  it("uzantı büyük harfli olsa da raster sayılır", () => {
    const url = toCommonsFileUrl(filePath("Foo.PNG"));
    expect(url).toContain("/thumb/");
  });
});
