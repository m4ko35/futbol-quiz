import { describe, expect, it } from "vitest";

import { InvalidSeasonDateError } from "@/domain/errors/domain-error";
import {
  EARLIEST_SEASON_YEAR,
  formatSeason,
  isPlausibleSeasonYear,
  toSeasonYear,
} from "@/domain/value-objects/season";

const utc = (iso: string) => new Date(iso);

describe("toSeasonYear — BR-6", () => {
  it("yaz transferini o yıl başlayan sezona atar", () => {
    expect(toSeasonYear(utc("2011-08-15T12:00:00Z"))).toBe(2011);
  });

  it("kış transferini bir önceki yıl başlayan sezona atar", () => {
    // Ocak 2012'de yapılan transfer 2011/12 sezonuna aittir.
    expect(toSeasonYear(utc("2012-01-31T12:00:00Z"))).toBe(2011);
  });

  it("sezon sınırının iki yanını ayırır", () => {
    expect(toSeasonYear(utc("2020-06-30T23:59:59Z"))).toBe(2019);
    expect(toSeasonYear(utc("2020-07-01T00:00:00Z"))).toBe(2020);
  });

  it("sunucunun saat diliminden etkilenmez", () => {
    // UTC'de 30 Haziran 22:00, UTC+3'te 1 Temmuz 01:00'dır. Yerel saat
    // alıcıları kullanılsaydı bu tarih yanlışlıkla 2020 sezonuna düşerdi.
    expect(toSeasonYear(utc("2020-06-30T22:00:00Z"))).toBe(2019);
  });

  it("ayrıştırılamayan tarihte alan hatası fırlatır", () => {
    expect(() => toSeasonYear(new Date("gecersiz"))).toThrow(
      InvalidSeasonDateError,
    );
  });
});

describe("formatSeason", () => {
  it("bitiş yılını iki basamakla yazar", () => {
    expect(formatSeason(2011)).toBe("2011/12");
  });

  it("yüzyıl dönümünde başa sıfır ekler", () => {
    expect(formatSeason(1999)).toBe("1999/00");
    expect(formatSeason(2009)).toBe("2009/10");
  });

  it("tam sayı olmayan girdiyi reddeder", () => {
    expect(() => formatSeason(2011.5)).toThrow(InvalidSeasonDateError);
  });
});

describe("isPlausibleSeasonYear — §8.2", () => {
  const now = utc("2026-07-28T00:00:00Z");

  it("aralık içindeki yılı kabul eder", () => {
    expect(isPlausibleSeasonYear(2011, now)).toBe(true);
    expect(isPlausibleSeasonYear(EARLIEST_SEASON_YEAR, now)).toBe(true);
  });

  it("gelecekte bir sezona kadar tolerans tanır", () => {
    // Yeni sezon kadroları, sezon başlamadan önce yayımlanır.
    expect(isPlausibleSeasonYear(2027, now)).toBe(true);
    expect(isPlausibleSeasonYear(2028, now)).toBe(false);
  });

  it("futbol öncesi ve tam sayı olmayan yılları reddeder", () => {
    expect(isPlausibleSeasonYear(EARLIEST_SEASON_YEAR - 1, now)).toBe(false);
    expect(isPlausibleSeasonYear(2011.5, now)).toBe(false);
  });
});
