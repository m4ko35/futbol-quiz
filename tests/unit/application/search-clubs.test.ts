import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLUB_RESULTS,
  MAX_CLUB_RESULTS,
  searchClubs,
} from "@/application/use-cases/search-clubs";
import { aClub } from "../../helpers/builders";
import { FakeClubRepository } from "../../helpers/fake-repositories";

const clubs = [
  aClub({ name: "Galatasaray Spor Kulübü", shortName: "Galatasaray" }),
  aClub({ name: "Fenerbahçe Spor Kulübü", shortName: "Fenerbahçe" }),
  aClub({ name: "Beşiktaş JK", shortName: "Beşiktaş" }),
  aClub({ name: "İstanbul Başakşehir FK", shortName: "Başakşehir" }),
  aClub({
    name: "Olympique Lillois",
    shortName: "Lillois",
    isSelectable: false,
  }),
];

function deps() {
  return { clubs: new FakeClubRepository(clubs) };
}

describe("searchClubs use-case", () => {
  it("arama metni verilmezse seçilebilir kulüpleri listeler", async () => {
    const result = await searchClubs({}, deps());

    expect(result.map((c) => c.shortName)).toEqual([
      "Başakşehir",
      "Beşiktaş",
      "Fenerbahçe",
      "Galatasaray",
    ]);
  });

  it("seçilemez kulüpleri hiçbir zaman döndürmez", async () => {
    const result = await searchClubs({ term: "Lillois" }, deps());

    expect(result).toEqual([]);
  });

  it("Türkçe karakterlerle arama yapabilir", async () => {
    // "Beşiktaş" araması aksansız anahtar üzerinden çalışmalı; aksi hâlde
    // kullanıcı kendi yazdığı adı bulamaz.
    const result = await searchClubs({ term: "Beşiktaş" }, deps());

    expect(result.map((c) => c.shortName)).toEqual(["Beşiktaş"]);
  });

  it("aksansız yazımla da bulur", async () => {
    const result = await searchClubs({ term: "besiktas" }, deps());

    expect(result.map((c) => c.shortName)).toEqual(["Beşiktaş"]);
  });

  it("büyük İ ile başlayan adı bulur", async () => {
    // "İ" (U+0130) varsayılan toLowerCase ile bozulur; normalizasyon elle
    // yapılmasaydı bu arama boş dönerdi.
    const result = await searchClubs({ term: "İstanbul" }, deps());

    expect(result.map((c) => c.shortName)).toEqual(["Başakşehir"]);
  });

  it("boş ve yalnızca boşluktan oluşan metni 'arama yok' sayar", async () => {
    const all = await searchClubs({}, deps());

    expect(await searchClubs({ term: "" }, deps())).toEqual(all);
    expect(await searchClubs({ term: "   " }, deps())).toEqual(all);
  });

  it("varsayılan limit §6.1'deki değerdir", async () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      aClub({ name: `Kulüp ${String(i).padStart(2, "0")}` }),
    );

    const result = await searchClubs(
      {},
      { clubs: new FakeClubRepository(many) },
    );

    expect(result).toHaveLength(DEFAULT_CLUB_RESULTS);
  });

  it("§7.1: istemcinin verdiği limit üst sınırla kelepçelenir", async () => {
    const many = Array.from({ length: 100 }, (_, i) =>
      aClub({ name: `Kulüp ${String(i).padStart(3, "0")}` }),
    );

    const result = await searchClubs(
      { limit: 10_000 },
      { clubs: new FakeClubRepository(many) },
    );

    expect(result).toHaveLength(MAX_CLUB_RESULTS);
  });

  it.each([
    ["sıfır", 0],
    ["negatif", -5],
    ["ondalık", 3.7],
    ["NaN", Number.NaN],
    ["sonsuz", Number.POSITIVE_INFINITY],
  ])("geçersiz limit (%s) çökmeye yol açmaz", async (_label, limit) => {
    const result = await searchClubs({ limit }, deps());

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeLessThanOrEqual(MAX_CLUB_RESULTS);
  });

  it("çok uzun arama metni kırpılır", async () => {
    // §7.1 — sınırsız uzunlukta girdi kaynak tüketim saldırısına açıktır.
    const result = await searchClubs({ term: "a".repeat(5000) }, deps());

    expect(result).toEqual([]);
  });

  it("DTO yalnızca §6.1'deki alanları taşır", async () => {
    const [first] = await searchClubs({ term: "Galatasaray" }, deps());

    expect(Object.keys(first ?? {}).sort()).toEqual([
      "country",
      "crestUrl",
      "id",
      "name",
      "shortName",
    ]);
  });
});
