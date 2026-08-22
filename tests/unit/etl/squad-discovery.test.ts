import { describe, expect, it } from "vitest";

import {
  discoverSquadPlayers,
  type SquadReader,
} from "../../../scripts/etl/pipeline/squad-discovery";
import type { WikiSite } from "../../../scripts/etl/sources/wikipedia/client";
import { MANCHESTER_UNITED_SQUAD } from "../../fixtures/wikipedia-squads";

/**
 * Kadro keşfi — §4.3 Aşama 3.
 *
 * Ağ yok: istemcinin yalnızca iki metodu kullanılıyor ve ikisi de sahte
 * (`wikipedia-pass.ts` testleriyle aynı kalıp).
 *
 * Testlerin ağırlık merkezi SAYAÇLAR. Bu aşamanın çıktısı bir sonraki koşuda
 * kapı eşiği belirleyecek ve yanlış bir sayaç, ölçülmeden açılan bir eşik
 * demek. Aynı hata bir kez yapıldı: `unmatchedClubLinks` sayaca yazılıp liste
 * atılmıştı ve BR-42 kendi körlüğünü kanıt saymıştı (§8.2, Pineda).
 */
function reader(
  pages: Record<string, string>,
  entities: Record<string, string>,
): SquadReader {
  return {
    async *articleWikitext(_site: WikiSite, titles: readonly string[]) {
      const batch = new Map<string, string>();
      for (const title of titles) {
        const text = pages[title];
        if (text !== undefined) batch.set(title, text);
      }
      yield batch;
    },
    entityIds(_site: WikiSite, titles: readonly string[]) {
      const result = new Map<string, string>();
      for (const title of titles) {
        const qid = entities[title];
        if (qid !== undefined) result.set(title, qid);
      }
      return Promise.resolve(result);
    },
  };
}

const UNITED_ENTITIES: Record<string, string> = {
  "Senne Lammens": "Q-lammens",
  "Diogo Dalot": "Q-dalot",
  "Noussair Mazraoui": "Q-mazraoui",
  "Matthijs de Ligt": "Q-deligt",
  "Harry Maguire": "Q-maguire",
  "Lisandro Martínez": "Q-martinez",
};

const clubArticles = new Map([["Q-united", { en: "Manchester United F.C." }]]);

describe("discoverSquadPlayers", () => {
  const run = (
    known: string[] = [],
    entities: Record<string, string> = UNITED_ENTITIES,
  ) =>
    discoverSquadPlayers(
      reader({ "Manchester United F.C.": MANCHESTER_UNITED_SQUAD }, entities),
      { clubArticles, knownPlayerIds: new Set(known) },
    );

  it("evrende olmayan kadro oyuncularını bulur", async () => {
    const result = await run();

    expect(result.playerIds).toHaveLength(6);
    expect(result.playerIds).toContain("Q-maguire");
  });

  it("ZATEN evrende olan oyuncu sonuca girmez ama sayılır", async () => {
    const result = await run(["Q-maguire", "Q-dalot"]);

    expect(result.playerIds).not.toContain("Q-maguire");
    expect(result.stats.alreadyKnown).toBe(2);
    expect(result.stats.discovered).toBe(4);
  });

  it("kiralıktakileri ve altyapıyı keşfetmez", async () => {
    const result = await run([], {
      ...UNITED_ENTITIES,
      "André Onana": "Q-onana",
      "Chido Obi": "Q-obi",
    });

    expect(result.playerIds).not.toContain("Q-onana");
    expect(result.playerIds).not.toContain("Q-obi");
  });

  it("oyuncuyu hangi kulübün kadrosunda gördüğünü saklar", async () => {
    const result = await run();

    expect(result.clubsOf.get("Q-maguire")).toEqual(["Q-united"]);
  });

  it("Wikidata ögesi OLMAYAN başlığa kimlik uydurmaz", async () => {
    const eksik = { ...UNITED_ENTITIES };
    delete eksik["Harry Maguire"];

    const result = await run([], eksik);

    expect(result.playerIds).toHaveLength(5);
    expect(result.stats.unresolvedTitles).toBe(1);
    expect(result.stats.resolvedTitles).toBe(5);
  });

  it("bağlantısız satırı sayar ama çözmeye ÇALIŞMAZ", async () => {
    const text =
      "== Current squad ==\n{{fs start}}\n" +
      "{{fs player|no=1|name=[[Bağlantılı]]}}\n" +
      "{{fs player|no=2|name=Düz Metin}}\n" +
      "{{fs end}}";
    const result = await discoverSquadPlayers(
      reader({ Kulüp: text }, { Bağlantılı: "Q-a" }),
      {
        clubArticles: new Map([["Q-k", { en: "Kulüp" }]]),
        knownPlayerIds: new Set(),
      },
    );

    expect(result.stats.squadSlots).toBe(2);
    expect(result.stats.linkedSlots).toBe(1);
    expect(result.stats.unlinkedSlots).toBe(1);
  });

  it("kadro şablonu OLMAYAN kulübü ayrı sayar", async () => {
    const result = await discoverSquadPlayers(
      reader({ Kulüp: "== Tarihçe ==\nMetin." }, {}),
      {
        clubArticles: new Map([["Q-k", { en: "Kulüp" }]]),
        knownPlayerIds: new Set(),
      },
    );

    expect(result.stats.clubsWithArticle).toBe(1);
    expect(result.stats.clubsWithSquadBlock).toBe(0);
    expect(result.stats.clubsWithoutSquadBlock).toBe(1);
  });

  it("İngilizce makalesi olmayan kulübü hiç sormaz", async () => {
    const result = await discoverSquadPlayers(reader({}, {}), {
      clubArticles: new Map([["Q-k", { tr: "Kulüp" }]]),
      knownPlayerIds: new Set(),
    });

    expect(result.stats.clubsWithArticle).toBe(0);
    expect(result.playerIds).toEqual([]);
  });

  it("aynı oyuncu iki kulüpte geçerse kimliği bir kez, kulüpleri birleşik döner", async () => {
    const squad = (name: string) =>
      `== Current squad ==\n{{fs start}}\n{{fs player|no=1|name=[[${name}]]}}\n{{fs end}}`;
    const result = await discoverSquadPlayers(
      reader(
        { "Kulüp A": squad("Ortak"), "Kulüp B": squad("Ortak") },
        { Ortak: "Q-ortak" },
      ),
      {
        clubArticles: new Map([
          ["Q-a", { en: "Kulüp A" }],
          ["Q-b", { en: "Kulüp B" }],
        ]),
        knownPlayerIds: new Set(),
      },
    );

    expect(result.playerIds).toEqual(["Q-ortak"]);
    expect(result.clubsOf.get("Q-ortak")?.sort()).toEqual(["Q-a", "Q-b"]);
  });

  /*
    GERÇEK İSTEMCİNİN DAVRANIŞI. `articleWikitext` metni hem İSTENEN başlıkla
    hem MediaWiki'nin döndürdüğü asıl başlıkla haritaya koyar; yönlendirme
    varsa iki anahtar farklıdır.

    Bu test CANLI KOŞUDAN geriye yazıldı: üç kulüplük denemede 89 kadro yeri
    116 sayılmıştı, çünkü `Deportivo de La Coruña` bir yönlendirme. Önceki
    sahte istemci yalnızca istenen başlığı döndürdüğü için kusuru göremedi —
    yani hata koddan önce SAHTEDEYDİ.
  */
  it("yönlendirme takma adıyla gelen ikinci anahtar makaleyi İKİ KEZ saydırmaz", async () => {
    const squad =
      "== Current squad ==\n{{fs start}}\n" +
      "{{fs player|no=1|name=[[Oyuncu A]]}}\n" +
      "{{fs player|no=2|name=[[Oyuncu B]]}}\n" +
      "{{fs end}}";
    const client: SquadReader = {
      async *articleWikitext() {
        // İstenen ad + asıl ad, ikisi de aynı metne işaret ediyor.
        yield new Map([
          ["Deportivo de La Coruña", squad],
          ["Deportivo de A Coruña", squad],
        ]);
      },
      entityIds: () =>
        Promise.resolve(
          new Map([
            ["Oyuncu A", "Q-a"],
            ["Oyuncu B", "Q-b"],
          ]),
        ),
    };

    const result = await discoverSquadPlayers(client, {
      clubArticles: new Map([["Q-depor", { en: "Deportivo de La Coruña" }]]),
      knownPlayerIds: new Set(),
    });

    expect(result.stats.squadSlots).toBe(2);
    expect(result.stats.linkedSlots).toBe(2);
    expect(result.stats.clubsWithSquadBlock).toBe(1);
    expect(result.playerIds).toHaveLength(2);
    expect(result.clubsOf.get("Q-a")).toEqual(["Q-depor"]);
  });

  it("iki kulüp AYNI makaleyi gösteriyorsa makale bir kez okunur", async () => {
    // İkiz kulüpler (§5.3) aynı Vikipedi makalesine bağlanabiliyor.
    let reads = 0;
    const client: SquadReader = {
      async *articleWikitext(_site: WikiSite, titles: readonly string[]) {
        reads += titles.length;
        yield new Map(
          titles.map((t) => [
            t,
            "== Current squad ==\n{{fs start}}\n{{fs player|name=[[X]]}}\n{{fs end}}",
          ]),
        );
      },
      entityIds: () => Promise.resolve(new Map([["X", "Q-x"]])),
    };

    const result = await discoverSquadPlayers(client, {
      clubArticles: new Map([
        ["Q-1", { en: "Aynı Makale" }],
        ["Q-2", { en: "Aynı Makale" }],
      ]),
      knownPlayerIds: new Set(),
    });

    expect(reads).toBe(1);
    expect(result.clubsOf.get("Q-x")?.sort()).toEqual(["Q-1", "Q-2"]);
  });
});
