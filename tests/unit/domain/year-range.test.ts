import { describe, expect, it } from "vitest";
import {
  definitelyOverlaps,
  hasAnyYear,
  latestKnownYear,
} from "@/domain/value-objects/year-range";

describe("definitelyOverlaps", () => {
  it("iç içe geçmiş aralıkları örtüşmüş sayar", () => {
    expect(
      definitelyOverlaps(
        { start: 2010, end: 2016 },
        { start: 2012, end: 2014 },
      ),
    ).toBe(true);
  });

  it("kısmen kesişen aralıkları örtüşmüş sayar", () => {
    expect(
      definitelyOverlaps(
        { start: 2010, end: 2014 },
        { start: 2012, end: 2016 },
      ),
    ).toBe(true);
  });

  it("argüman sırasından etkilenmez", () => {
    const a = { start: 2010, end: 2014 };
    const b = { start: 2012, end: 2016 };
    expect(definitelyOverlaps(a, b)).toBe(definitelyOverlaps(b, a));
  });

  it("ayrık aralıkları örtüşmemiş sayar", () => {
    expect(
      definitelyOverlaps(
        { start: 2010, end: 2012 },
        { start: 2015, end: 2018 },
      ),
    ).toBe(false);
  });

  it("bitiş yılı = başlangıç yılı olan devri örtüşme SAYMAZ", () => {
    // Normal transferin biçimi tam olarak budur: 2012'de ayrıldı, 2012'de
    // katıldı. Bunu örtüşme saymak, sağlıklı verinin çoğunu hatalı gösterirdi.
    expect(
      definitelyOverlaps(
        { start: 2010, end: 2012 },
        { start: 2012, end: 2014 },
      ),
    ).toBe(false);
  });

  it("aynı yıl başlayan iki dönemi örtüşmüş sayar", () => {
    expect(
      definitelyOverlaps(
        { start: 2010, end: 2012 },
        { start: 2010, end: 2011 },
      ),
    ).toBe(true);
  });

  it("başlangıcı bilinmeyen aralık için örtüşme İDDİA ETMEZ", () => {
    expect(
      definitelyOverlaps(
        { start: null, end: 2014 },
        { start: 2012, end: 2016 },
      ),
    ).toBe(false);
  });

  it("erken dönemin bitişi bilinmiyorsa örtüşme İDDİA ETMEZ", () => {
    // Açık uçlu aralık her şeyle örtüşüyor gibi görünür; bu bir bilgi değil,
    // bilgisizliktir. Karamsar davranmak doğru olandır.
    expect(
      definitelyOverlaps(
        { start: 2010, end: null },
        { start: 2012, end: 2016 },
      ),
    ).toBe(false);
  });

  it("hiç yıl bilgisi olmayan aralıklarda örtüşme İDDİA ETMEZ", () => {
    expect(
      definitelyOverlaps(
        { start: null, end: null },
        { start: null, end: null },
      ),
    ).toBe(false);
  });
});

describe("latestKnownYear", () => {
  it("bitiş yılı biliniyorsa onu verir", () => {
    expect(latestKnownYear({ start: 2010, end: 2014 })).toBe(2014);
  });

  it("bitiş bilinmiyorsa başlangıca düşer", () => {
    expect(latestKnownYear({ start: 2010, end: null })).toBe(2010);
  });

  it("hiçbiri bilinmiyorsa null verir", () => {
    expect(latestKnownYear({ start: null, end: null })).toBeNull();
  });

  it("bitiş 0 olsa bile null'a düşmez", () => {
    // `??` yerine `||` kullanılsaydı 0 sahte-negatif üretirdi. Gerçekçi bir
    // yıl değil ama operatör seçimini kilitleyen bir denetim.
    expect(latestKnownYear({ start: 1990, end: 0 })).toBe(0);
  });
});

describe("hasAnyYear", () => {
  it("tek uç bile biliniyorsa doğrudur", () => {
    expect(hasAnyYear({ start: null, end: 2014 })).toBe(true);
    expect(hasAnyYear({ start: 2010, end: null })).toBe(true);
  });

  it("hiçbir uç bilinmiyorsa yanlıştır", () => {
    expect(hasAnyYear({ start: null, end: null })).toBe(false);
  });
});
