import {
  WIKI_SITES,
  type ArticleTitles,
  type WikipediaClient,
  type WikiSite,
} from "../sources/wikipedia/client";
import {
  parseInfoboxSpells,
  type InfoboxSpell,
} from "../sources/wikipedia/infobox";
import type { WikipediaSpell } from "./merge-wikipedia";

/**
 * Vikipedi geçişi — bilgi kutularını çeker, ayrıştırır, kulüplerle eşleştirir
 * (PROJECT.md §4.3).
 *
 * Bu dosya AĞA ÇIKAR; saf olan iki parçası ayrı modüllerde durur
 * (`sources/wikipedia/infobox.ts` ayrıştırma, `merge-wikipedia.ts`
 * birleştirme). Buradaki iş yalnızca sıralama ve ölçüm.
 *
 * EŞLEŞTİRME TERS YÖNDE ÇALIŞIR ve bu ölçülmüş bir karardır. İlk tasarım
 * bilgi kutusundaki HER kulüp bağlantısını MediaWiki'ye sorup QID'ye
 * çeviriyordu; iki kulüplük denemede 3.250 başlık için 65 istek gerekti ve
 * bunların %70'i evren dışı çıktı — yani isteklerin çoğu, atılacak veriyi
 * çözmek için harcanıyordu. Şimdi tersi yapılıyor: EVRENDEKİ kulüplerin
 * makale adları ve yönlendirme takma adları bir kez indekslenir, bilgi
 * kutusundaki bağlantı bu indekste aranır. Ağ maliyeti kulüp sayısıyla
 * (423) sınırlı, oyuncu sayısıyla değil.
 *
 * Yan etkisi: §4.3'ün 5. kuralı ("kulüp evrenini Vikipedi belirlemez") artık
 * yapısal olarak sağlanıyor — evren dışı bir kulübü tanımanın yolu yok.
 */

export interface WikipediaPassStats {
  playersWithArticle: number;
  playersWithoutArticle: number;
  articlesBySite: Record<WikiSite, number>;
  /** Bilgi kutusundan okunan ham kariyer satırı. */
  parsedRows: number;
  /** Evrendeki bir kulübe bağlanamayan satır — atlandı, tahmin edilmedi. */
  unmatchedClubLinks: number;
  /** Aynı dönemin ikinci dildeki kopyası. */
  duplicateRows: number;
  /** İndekslenen kulüp adı (asıl ad + yönlendirme takma adları). */
  clubTitlesIndexed: number;
}

export interface WikipediaPassResult {
  readonly spells: WikipediaSpell[];
  readonly stats: WikipediaPassStats;
}

export interface WikipediaPassInput {
  /** Oyuncu QID → makale adları (SPARQL'den). */
  readonly playerArticles: ReadonlyMap<string, ArticleTitles>;
  /** Kulüp QID → makale adları (SPARQL'den). Evreni bu tanımlar. */
  readonly clubArticles: ReadonlyMap<string, ArticleTitles>;
  readonly noCache?: boolean;
}

export async function collectWikipediaSpells(
  client: WikipediaClient,
  input: WikipediaPassInput,
): Promise<WikipediaPassResult> {
  const options = { noCache: input.noCache ?? false };

  const stats: WikipediaPassStats = {
    playersWithArticle: input.playerArticles.size,
    playersWithoutArticle: 0,
    articlesBySite: { tr: 0, en: 0 },
    parsedRows: 0,
    unmatchedClubLinks: 0,
    duplicateRows: 0,
    clubTitlesIndexed: 0,
  };

  /** Dil başına `makale adı → kulüp QID`. */
  const clubIndex = new Map<WikiSite, Map<string, string>>();
  /** Oyuncu QID → okunan satırlar (dil sırasıyla). */
  const rowsByPlayer = new Map<
    string,
    { site: WikiSite; row: InfoboxSpell }[]
  >();

  for (const site of WIKI_SITES) {
    // ─── 1. Evrendeki kulüplerin ad indeksi ─────────────────────────────
    const canonical = new Map<string, string>();
    for (const [clubId, article] of input.clubArticles) {
      const title = article[site];
      if (title !== undefined) canonical.set(title, clubId);
    }

    const index = new Map(canonical);
    if (canonical.size > 0) {
      console.log(`      ${site}: ${canonical.size} kulübün takma adları…`);
      const aliases = await client.redirectAliases(
        site,
        [...canonical.keys()],
        options,
      );
      for (const [alias, target] of aliases) {
        const clubId = canonical.get(target);
        // Takma ad ASIL ADIN ÜZERİNE YAZMAZ: bir kulübün adı başka bir
        // kulübün yönlendirmesi olabilir (birleşen/ayrılan kulüpler).
        if (clubId !== undefined && !index.has(alias)) index.set(alias, clubId);
      }
    }
    clubIndex.set(site, index);
    stats.clubTitlesIndexed += index.size;

    // ─── 2. Oyuncu makaleleri ───────────────────────────────────────────
    const wanted = new Map<string, string[]>();
    for (const [playerId, article] of input.playerArticles) {
      const title = article[site];
      if (title === undefined) continue;
      wanted.set(title, [...(wanted.get(title) ?? []), playerId]);
    }
    stats.articlesBySite[site] = wanted.size;
    if (wanted.size === 0) continue;

    console.log(`      ${site}: ${wanted.size} makale çekiliyor…`);

    // Metin GRUP GRUP tüketilir ve ayrıştırıldıktan sonra bırakılır; hepsini
    // biriktirmek ~2,4 GB tutardı (bkz. `articleWikitext`). Bellekte kalan
    // yalnızca kariyer satırları.
    for await (const texts of client.articleWikitext(
      site,
      [...wanted.keys()],
      options,
    )) {
      for (const [title, text] of texts) {
        const playerIdList = wanted.get(title);
        if (playerIdList === undefined) continue;

        const rows = parseInfoboxSpells(text);
        if (rows.length === 0) continue;

        for (const playerId of playerIdList) {
          const list = rowsByPlayer.get(playerId) ?? [];
          for (const row of rows) {
            list.push({ site, row });
            stats.parsedRows++;
          }
          rowsByPlayer.set(playerId, list);
        }
      }
    }
  }

  // ─── 3. Kulüpleri eşleştir ve dilleri birleştir ───────────────────────
  const spells: WikipediaSpell[] = [];

  for (const [playerId, entries] of rowsByPlayer) {
    // Aynı dönemin ikinci dildeki kopyası atılır. Anahtar kulüp QID'i +
    // başlangıç yılı: iki dilin AYNI dönemi iki kez saymasını engeller.
    const seen = new Set<string>();

    for (const { site, row } of entries) {
      const clubId = clubIndex.get(site)?.get(row.clubTitle);
      if (clubId === undefined) {
        stats.unmatchedClubLinks++;
        continue;
      }

      const key = `${clubId}|${row.startYear ?? "?"}`;
      if (seen.has(key)) {
        stats.duplicateRows++;
        continue;
      }
      seen.add(key);

      spells.push({
        playerWikidataId: playerId,
        clubWikidataId: clubId,
        startYear: row.startYear,
        endYear: row.endYear,
        appearances: row.appearances,
        goals: row.goals,
        isLoan: row.isLoan,
      });
    }
  }

  return { spells, stats };
}
