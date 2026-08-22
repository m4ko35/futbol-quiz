import type {
  ArticleTitles,
  FetchOptions,
  WikiSite,
} from "../sources/wikipedia/client";
import { parseSquadBlocks, pickFirstTeam } from "../sources/wikipedia/squad";

/**
 * Kadro keşfi — PROJECT.md §4.3, Aşama 3.
 *
 * Bu dosya AĞA ÇIKAR; ayrıştırma saf olan `sources/wikipedia/squad.ts` içinde
 * durur. Buradaki iş yalnızca sıralama, çözümleme ve ölçüm.
 *
 * NEDEN VAR. Oyuncu evrenini Wikidata'nın `P54` ifadeleri tanımlıyor ve tam
 * sayımla ölçüldü: güncel kadroların **%43'ü** o ifadelerde yok. Eksik 5.547
 * oyuncunun **hiçbirinde** evrendeki bir kulübe `P54` bağı bulunmuyor, yani
 * boşluk kaçırdığımız bir şey değil — kaynağın hiç söylemediği bir şey.
 *
 * NE YAPMIYOR, BİLEREK:
 *
 *   · **Kulüp evrenini genişletmiyor.** §4.3'ün 5. kuralı yerinde: yalnızca
 *     zaten evrende olan kulüplerin makaleleri okunur. Keşfedilen oyuncunun
 *     kariyeri de yalnızca evrendeki kulüplere düşen satırlarıyla girer.
 *   · **Dönem üretmiyor.** Bu aşamanın çıktısı bir OYUNCU KİMLİĞİ listesidir.
 *     Kariyeri, zaten yazılmış olan Vikipedi geçişi (§4.3) okur; kimliğin
 *     kendisi `playerDetails` ile Wikidata'dan gelir — o sorgu `P54` şartı
 *     koşmaz, keyfi bir QID listesi alır.
 *   · **Kimlik uydurmuyor.** Wikidata ögesi olmayan makale sonuçta yer almaz.
 */

/**
 * Keşif YALNIZCA İngilizce yapılır.
 *
 * `{{fs player}}` ailesi tek bir şablon ailesidir ve evrendeki kulüplerin
 * 877/889'unda mevcut. Her dilin kendi kadro şablonunu ayrıştırmak gereksiz:
 * keşfin dili ile doğrulamanın dili aynı olmak zorunda değil. Keşif `en`'de
 * yapılır, kariyer beş dilde doğrulanır (BR-60).
 */
export const DISCOVERY_SITE: WikiSite = "en";

/**
 * İstemcinin bu aşamada kullanılan DAR yüzü.
 *
 * Tam `WikipediaClient` yerine iki metotluk bir arayüz isteniyor; testin ağa
 * çıkmadan koşabilmesinin şartı bu (§8.1, `wikipedia-pass.ts` ile aynı kalıp).
 */
export interface SquadReader {
  articleWikitext(
    site: WikiSite,
    titles: readonly string[],
    options?: FetchOptions,
  ): AsyncGenerator<Map<string, string>>;
  entityIds(
    site: WikiSite,
    titles: readonly string[],
    options?: FetchOptions,
  ): Promise<Map<string, string>>;
}

export interface SquadDiscoveryStats {
  /** Evrende olup İngilizce makalesi bulunan kulüp. */
  clubsWithArticle: number;
  /** Makalesinde `{{fs start}}` bloğu bulunan kulüp. */
  clubsWithSquadBlock: number;
  /**
   * Kadro şablonu OLMAYAN kulüp — düz tabloyla yazılmış kadrolar.
   *
   * Ölçüldü: 877 kulübün 147'si. Bu bir hata değil kapsam sınırıdır ve
   * sayılması gerekiyor, çünkü keşfin ulaşamadığı yeri yalnızca bu sayı
   * gösterir (§2.7 — sessizlik kanıt değildir).
   */
  clubsWithoutSquadBlock: number;
  /** Birinci takım bloğundaki toplam satır. */
  squadSlots: number;
  /** Bağlantısı olan satır — yalnızca bunlar çözülebilir. */
  linkedSlots: number;
  /** Makalesi olmayan oyuncu; hiçbir yöntemle bulunamaz. */
  unlinkedSlots: number;
  /** QID'ye çözülen tekil başlık. */
  resolvedTitles: number;
  /** Makalesi var ama Wikidata ögesi YOK. */
  unresolvedTitles: number;
  /** Zaten evrende olan oyuncu — keşfin doğruladığı, eklemediği kısım. */
  alreadyKnown: number;
  /** EVRENE YENİ GİREN oyuncu. */
  discovered: number;
}

export interface SquadDiscoveryResult {
  /** Evrende olmayan, kadro şablonlarında bulunan oyuncuların QID'leri. */
  readonly playerIds: string[];
  /**
   * Keşfedilen oyuncu → kadrosunda bulunduğu kulüplerin QID'leri.
   *
   * Dönem ÜRETMEZ ve üretmek için kullanılmamalıdır: kadro şablonu bir
   * kariyer kaydı değil, bugünkü bir listedir — yılı, maçı, golü yoktur.
   * Taşıdığı bilgi yalnızca "bu oyuncu şu kulübün sayfasında görüldü" ve
   * değeri raporlamada (§8.2).
   */
  readonly clubsOf: ReadonlyMap<string, string[]>;
  readonly stats: SquadDiscoveryStats;
}

export interface SquadDiscoveryInput {
  /** Kulüp QID → dil başına makale adı; yalnızca `en` okunur. */
  readonly clubArticles: ReadonlyMap<string, ArticleTitles>;
  /** Evrende ZATEN olan oyuncular — bunlar keşif sonucuna girmez. */
  readonly knownPlayerIds: ReadonlySet<string>;
  readonly noCache?: boolean;
}

export async function discoverSquadPlayers(
  client: SquadReader,
  input: SquadDiscoveryInput,
): Promise<SquadDiscoveryResult> {
  const titleToClubs = new Map<string, Set<string>>();
  const stats: SquadDiscoveryStats = {
    clubsWithArticle: 0,
    clubsWithSquadBlock: 0,
    clubsWithoutSquadBlock: 0,
    squadSlots: 0,
    linkedSlots: 0,
    unlinkedSlots: 0,
    resolvedTitles: 0,
    unresolvedTitles: 0,
    alreadyKnown: 0,
    discovered: 0,
  };

  // Aynı makale adı iki kulüpte de geçebilir (ikiz kulüpler, §5.3); istek
  // başlık başına bir kez yapılsın diye ters indeks kurulur.
  const clubsByTitle = new Map<string, string[]>();
  for (const [clubQid, titles] of input.clubArticles) {
    const title = titles[DISCOVERY_SITE];
    if (title === undefined) continue;
    stats.clubsWithArticle++;
    clubsByTitle.set(title, [...(clubsByTitle.get(title) ?? []), clubQid]);
  }

  const options = { noCache: input.noCache ?? false };

  for await (const chunk of client.articleWikitext(
    DISCOVERY_SITE,
    [...clubsByTitle.keys()],
    options,
  )) {
    for (const [title, wikitext] of chunk) {
      /*
        AYNI MAKALE BİRDEN ÇOK ANAHTARLA GELİR ve sayılmayan biri atlanmalıdır.

        `articleWikitext`, metni hem İSTENEN başlıkla hem MediaWiki'nin
        döndürdüğü asıl başlıkla haritaya koyuyor (`originsOf`); yönlendirme
        varsa iki anahtar farklıdır. İkisini de işlemek makaleyi iki kez sayar.

        CANLI KOŞUDA ÖLÇÜLDÜ, birim testi göremedi: üç kulüplük denemede 89
        kadro yeri 116 sayıldı, çünkü `Deportivo de La Coruña` bir yönlendirme
        ve asıl başlık `Deportivo de A Coruña`. Sahte istemci yalnızca istenen
        başlığı döndürdüğü için test temizdi — kusur, sahtenin gerçeğe
        benzemediği yerdeydi.
      */
      const clubQids = clubsByTitle.get(title);
      if (clubQids === undefined) continue;

      const block = pickFirstTeam(parseSquadBlocks(wikitext));

      if (block === null) {
        stats.clubsWithoutSquadBlock += clubQids.length;
        continue;
      }
      stats.clubsWithSquadBlock += clubQids.length;

      for (const entry of block.entries) {
        stats.squadSlots++;
        if (entry.title === null) {
          stats.unlinkedSlots++;
          continue;
        }
        stats.linkedSlots++;

        const seen = titleToClubs.get(entry.title) ?? new Set<string>();
        for (const clubQid of clubQids) seen.add(clubQid);
        titleToClubs.set(entry.title, seen);
      }
    }
  }

  const qidByTitle = await client.entityIds(
    DISCOVERY_SITE,
    [...titleToClubs.keys()],
    options,
  );

  const clubsOf = new Map<string, string[]>();
  for (const [title, clubQids] of titleToClubs) {
    const qid = qidByTitle.get(title);
    if (qid === undefined) {
      stats.unresolvedTitles++;
      continue;
    }
    stats.resolvedTitles++;

    if (input.knownPlayerIds.has(qid)) {
      stats.alreadyKnown++;
      continue;
    }

    // İki başlık aynı QID'ye çözülebilir (yönlendirme); kulüpler birleşir.
    const merged = new Set([...(clubsOf.get(qid) ?? []), ...clubQids]);
    clubsOf.set(qid, [...merged]);
  }

  stats.discovered = clubsOf.size;

  return { playerIds: [...clubsOf.keys()], clubsOf, stats };
}
