import { describe, expect, it } from "vitest";

import {
  collectWikipediaSpells,
  type WikipediaReader,
} from "../../../scripts/etl/pipeline/wikipedia-pass";
import type { WikiSite } from "../../../scripts/etl/sources/wikipedia/client";

/**
 * Vikipedi geçişinin ÇÖZÜLEMEYEN SATIR muhasebesi — §4.3, §8.2.
 *
 * NEDEN AYRI BİR TEST DOSYASI. Bu geçişin çıktısı iki tüketiciye gidiyor ve
 * biri ötekinin varsaydığı şeyi bozabiliyor: birleştirme yalnızca çözülmüş
 * satırları ister, BR-42 ise ÇÖZÜLEMEYENLERİ bilmek zorundadır. İkisi
 * ayrışırsa kapı sessizce yanlış karar verir — nitekim verdi (Pineda).
 *
 * Ağ yok: istemcinin yalnızca iki metodu kullanılıyor ve ikisi de sahte.
 */

/** Metni tek grup hâlinde döndüren sahte istemci. */
function reader(pages: Record<string, string>): WikipediaReader {
  return {
    async *articleWikitext(_site: WikiSite, titles: readonly string[]) {
      const batch = new Map<string, string>();
      for (const title of titles) {
        const text = pages[title];
        if (text !== undefined) batch.set(title, text);
      }
      yield batch;
    },
    redirectAliases(): Promise<Map<string, string>> {
      // Takma ad YOK — indekste eksik kalan adı taklit etmenin en dar yolu.
      return Promise.resolve(new Map());
    },
  };
}

/**
 * İki kulüplü bir İngilizce bilgi kutusu.
 *
 * `AEK Athens F.C.` bilerek indekse KONMUYOR: Pineda vakasının şekli tam
 * olarak bu — bilgi kutusu kulüpten söz ediyor ama biz bağlayamıyoruz.
 */
const INFOBOX = `{{Infobox football biography
| name = Test
| years1 = 2019–2023 | clubs1 = [[Celta Vigo]] | caps1 = 80 | goals1 = 9
| years2 = 2023– | clubs2 = [[AEK Athens F.C.]] | caps2 = 94 | goals2 = 12
}}`;

describe("collectWikipediaSpells — çözülemeyen bağlantılar", () => {
  const run = () =>
    collectWikipediaSpells(reader({ Oyuncu: INFOBOX }), {
      playerArticles: new Map([["Q1", { en: "Oyuncu" }]]),
      clubArticles: new Map([["Q-celta", { en: "Celta Vigo" }]]),
    });

  it("çözülen satır dönem olur, çözülemeyen ATILMAZ", async () => {
    const result = await run();

    expect(result.spells).toHaveLength(1);
    expect(result.spells[0]?.clubWikidataId).toBe("Q-celta");

    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0]).toMatchObject({
      playerWikidataId: "Q1",
      clubTitle: "AEK Athens F.C.",
      site: "en",
      startYear: 2023,
      isLoan: false,
    });
  });

  it("liste ile sayaç AYRIŞAMAZ", async () => {
    // BR-42 listeye, günlük sayaca bakıyor. İkisi ayrılırsa biri yalan söyler.
    const result = await run();

    expect(result.unresolved).toHaveLength(result.stats.unmatchedClubLinks);
  });

  it("çözülemeyen satır kulüp evrenine SIZMAZ", async () => {
    // §4.3'ün 5. kuralı: evreni Vikipedi belirlemez. Satırın taşıdığı tek şey
    // ham başlık; ondan bir QID uydurulmuyor.
    const result = await run();

    expect(result.spells.map((s) => s.clubWikidataId)).toEqual(["Q-celta"]);
    expect(Object.keys(result.unresolved[0] ?? {})).not.toContain(
      "clubWikidataId",
    );
  });
});
