import { describe, expect, it } from "vitest";
import { getPopularPairs } from "@/application/use-cases/popular-pairs";
import type { Club } from "@/domain/entities/club";
import { clubId } from "@/domain/value-objects/identifiers";
import { aClub } from "../../helpers/builders";
import { FakeClubRepository } from "../../helpers/fake-repositories";

/**
 * getPopularPairs — küratörlü çiftleri güncel kulüplere çözer.
 *
 * FakeClubRepository, QID'yi kulübün `id`'si sayar (bkz. fake yorumu); testler
 * bu yüzden kulüp id'lerini POPULAR_PAIR_QIDS ile aynı QID'lere sabitler.
 * Sorulan şey: doğru eşleme, doğru sıra ve bir kulüp düştüğünde DÜRÜST atlama.
 */

const club = (qid: string, shortName: string, overrides: Partial<Club> = {}) =>
  aClub({ id: clubId(qid), shortName, ...overrides });

/** Use-case'in beklediği altı QID (dosyadaki POPULAR_PAIR_QIDS ile birebir). */
const ALL: readonly Club[] = [
  club("Q495299", "Galatasaray"),
  club("Q8682", "Real Madrid"),
  club("Q6601875", "Fenerbahçe"),
  club("Q631", "Inter"),
  club("Q172567", "Beşiktaş"),
  club("Q7156", "Barcelona"),
];

describe("getPopularPairs use-case", () => {
  it("küratörlü çiftleri güncel kulüplere çözer ve sırayı korur", async () => {
    const pairs = await getPopularPairs({ clubs: new FakeClubRepository(ALL) });

    expect(pairs.map((p) => [p.a.shortName, p.b.shortName])).toEqual([
      ["Galatasaray", "Real Madrid"],
      ["Fenerbahçe", "Inter"],
      ["Beşiktaş", "Barcelona"],
    ]);
  });

  it("bir kulüp veri kümesinde YOKSA o çifti atlar, ötekiler kalır", async () => {
    // Real Madrid (Q8682) düşürülür → yalnızca GS×RM çifti atlanmalı.
    const without = ALL.filter((c) => c.id !== clubId("Q8682"));

    const pairs = await getPopularPairs({
      clubs: new FakeClubRepository(without),
    });

    expect(pairs.map((p) => [p.a.shortName, p.b.shortName])).toEqual([
      ["Fenerbahçe", "Inter"],
      ["Beşiktaş", "Barcelona"],
    ]);
  });

  it("seçilemez kulüp çift üretmez (uydurma ad basılmaz)", async () => {
    // Barcelona (Beşiktaş'ın eşi) seçilemez işaretlenir → o çift düşer.
    const clubs = ALL.map((c) =>
      c.id === clubId("Q7156") ? { ...c, isSelectable: false } : c,
    );

    const pairs = await getPopularPairs({
      clubs: new FakeClubRepository(clubs),
    });

    expect(pairs).toHaveLength(2);
    expect(pairs.some((p) => p.b.shortName === "Barcelona")).toBe(false);
  });

  it("hiçbir kulüp çözülemezse boş döner (arayüz bölümü hiç basmaz)", async () => {
    const pairs = await getPopularPairs({
      clubs: new FakeClubRepository([]),
    });

    expect(pairs).toEqual([]);
  });
});
