import { describe, expect, it } from "vitest";
import {
  MAX_PLAYER_RESULTS,
  MAX_PLAYER_TERM_LENGTH,
  MIN_PLAYER_TERM_LENGTH,
  searchPlayers,
} from "@/application/use-cases/search-players";
import type { PlayerRepository } from "@/application/ports/player-repository";
import { aPlayer, aSpell } from "../../helpers/builders";
import { FakePlayerRepository } from "../../helpers/fake-repositories";

/** §6.4 — oyuncu arama, ızgarada cevap seçmek için. */

function deps(names: readonly string[]): {
  players: PlayerRepository;
  lastQuery: () => { term: string; limit: number } | null;
} {
  const candidates = names.map((name) => {
    const player = aPlayer({ name });
    return { player, spells: [aSpell({ playerId: player.id })] };
  });

  let lastQuery: { term: string; limit: number } | null = null;
  const base = new FakePlayerRepository(candidates);

  const players: PlayerRepository = {
    findCommonPlayers: base.findCommonPlayers.bind(base),
    findIdsMatching: base.findIdsMatching.bind(base),
    findPlayableCriteria: base.findPlayableCriteria.bind(base),
    matchesAll: base.matchesAll.bind(base),
    search(query) {
      lastQuery = { term: query.term, limit: query.limit };
      return base.search(query);
    },
  };

  return { players, lastQuery: () => lastQuery };
}

describe("searchPlayers", () => {
  it("ada göre eşleşen oyuncuları döner", async () => {
    const { players } = deps(["Esteban Cambiasso", "Andrea Pirlo"]);

    const result = await searchPlayers({ term: "cambi" }, { players });

    expect(result.map((p) => p.name)).toEqual(["Esteban Cambiasso"]);
  });

  /**
   * 76.358 kayıtlık bir tabloda tek harflik arama on binlerce satır tarar ve
   * kullanıcıya da yaramaz. Bu bir kural ihlali DEĞİL, henüz tamamlanmamış bir
   * girdidir — hata değil boş liste döner.
   */
  it("kısa metinde depoya HİÇ gitmez", async () => {
    const { players, lastQuery } = deps(["Esteban Cambiasso"]);

    const result = await searchPlayers({ term: "c" }, { players });

    expect(result).toEqual([]);
    expect(lastQuery()).toBeNull();
  });

  it("alt sınır kadar karakterde arama başlar", async () => {
    const { players, lastQuery } = deps(["Esteban Cambiasso"]);

    await searchPlayers(
      { term: "c".repeat(MIN_PLAYER_TERM_LENGTH) },
      {
        players,
      },
    );

    expect(lastQuery()).not.toBeNull();
  });

  it("boşluk kırpılır ve kısa sayılır", async () => {
    const { players, lastQuery } = deps(["Esteban Cambiasso"]);

    await searchPlayers({ term: "  c  " }, { players });

    expect(lastQuery()).toBeNull();
  });

  /** §7.1 — istemcinin verdiği değere güvenilmez, kelepçelenir. */
  it.each([
    ["üst sınırı aşan limit", 9999, MAX_PLAYER_RESULTS],
    ["sıfır limit", 0, 1],
    ["negatif limit", -5, 1],
    ["ondalıklı limit", 3.9, 3],
  ])("%s kelepçelenir", async (_label, given, expected) => {
    const { players, lastQuery } = deps(["Esteban Cambiasso"]);

    await searchPlayers({ term: "cambi", limit: given }, { players });

    expect(lastQuery()?.limit).toBe(expected);
  });

  it("limit verilmezse varsayılan uygulanır", async () => {
    const { players, lastQuery } = deps(["Esteban Cambiasso"]);

    await searchPlayers({ term: "cambi" }, { players });

    expect(lastQuery()?.limit).toBeGreaterThan(0);
    expect(lastQuery()?.limit).toBeLessThanOrEqual(MAX_PLAYER_RESULTS);
  });

  it("uzun arama metni kırpılır", async () => {
    const { players, lastQuery } = deps(["Esteban Cambiasso"]);

    await searchPlayers({ term: "a".repeat(500) }, { players });

    expect(lastQuery()?.term).toHaveLength(MAX_PLAYER_TERM_LENGTH);
  });

  /**
   * Oyuncunun kulüp geçmişi yanıta ÇIKMAZ: çıksaydı arama kutusu ızgaranın
   * cevap anahtarına dönüşürdü (§9.1).
   */
  it("yanıt yalnızca kimlik, ad, uyruk ve mevki taşır", async () => {
    const { players } = deps(["Esteban Cambiasso"]);

    const [first] = await searchPlayers({ term: "cambi" }, { players });

    expect(first).toBeDefined();
    expect(Object.keys(first!).sort()).toEqual([
      "id",
      "name",
      "nationality",
      "position",
    ]);
  });
});
