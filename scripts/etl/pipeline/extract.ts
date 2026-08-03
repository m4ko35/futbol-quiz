import { MIN_SPELLS_FOR_SELECTABLE, TARGET_LEAGUES } from "../leagues";
import type { WikidataClient } from "../sources/wikidata/client";
import {
  articleTitleFromUrl,
  type ArticleTitles,
  type WikipediaClient,
} from "../sources/wikipedia/client";
import {
  PLAYER_BATCH_SIZE,
  clubsByLeagueLink,
  clubsFromSeasonParents,
  clubsFromSeasons,
  mensNationalTeams,
  playerDetails,
  playerPhysical,
  playerStats,
  spellsAtClub,
  verifyLeagues,
  wikipediaArticles,
} from "../sources/wikidata/queries";
import { int, qid, str } from "../sources/wikidata/schemas";
import { mergeWikipediaSpells } from "./merge-wikipedia";
import {
  applyPlayerStats,
  dedupeBy,
  isInScope,
  looksLikeYouthOrReserve,
  nationalCapsFrom,
  physicalFrom,
  toClub,
  toPlayer,
  toSpell,
  type NormalizedClub,
  type NormalizedPlayer,
  type NormalizedSpell,
} from "./normalize";
import { collectWikipediaSpells } from "./wikipedia-pass";

export interface ExtractedDataset {
  readonly clubs: NormalizedClub[];
  readonly players: NormalizedPlayer[];
  readonly spells: NormalizedSpell[];
  readonly selectableClubIds: Set<string>;
  /** Dönemleri fiilen sorgulanan kulüpler (kısmi koşularda alt küme). */
  readonly fetchedClubIds: Set<string>;
}

export interface ExtractOptions {
  /** Yalnızca ilk N kulübü çeker — küçük deneme koşuları için. */
  readonly maxClubs?: number;
  readonly noCache?: boolean;
  /**
   * Vikipedi katmanını atlar (§4.3).
   *
   * Yalnızca ölçüm için: iki koşuyu karşılaştırıp katmanın gerçek kazancını
   * görmek istediğinizde. Üretim koşusunda kapatılmaz.
   */
  readonly skipWikipedia?: boolean;
}

/**
 * Lig kimliklerinin gerçekten beklenen ligler olduğunu doğrular.
 *
 * Bu adım isteğe bağlı bir güvence değil: ilk taslakta Süper Lig için yazılan
 * QID (`Q170323`) aslında **Nintendo DS**'e aitti ve yalnızca böyle bir
 * denetim bunu yakalayabilirdi.
 */
export async function verifyLeagueIds(
  client: WikidataClient,
  options: ExtractOptions = {},
): Promise<{ ok: boolean; lines: string[] }> {
  const ids = TARGET_LEAGUES.map((l) => l.wikidataId);
  const bindings = await client.query(verifyLeagues(ids), {
    label: "verify-leagues",
    noCache: options.noCache ?? false,
  });

  const byQid = new Map(
    bindings.flatMap((b) => {
      const id = qid(b, "league");
      return id === undefined ? [] : ([[id, b]] as const);
    }),
  );

  const lines: string[] = [];
  let ok = true;

  for (const league of TARGET_LEAGUES) {
    const binding = byQid.get(league.wikidataId);
    if (binding === undefined) {
      lines.push(`  ✗ ${league.wikidataId} (${league.name}): sonuç dönmedi`);
      ok = false;
      continue;
    }

    const label = str(binding, "leagueLabel") ?? "?";
    const count = int(binding, "clubCount") ?? 0;

    // Etiket servisi zaman zaman QID'e düşüyor; bu bir hata değil, o yüzden
    // yalnızca etiket çözülebildiğinde ad karşılaştırması yapılır.
    const labelResolved = label !== league.wikidataId;
    const nameMatches =
      !labelResolved ||
      label.toLowerCase().includes(league.name.toLowerCase().slice(0, 6));

    if (!nameMatches || count < league.minClubs) {
      lines.push(
        `  ✗ ${league.wikidataId}: "${label}" (${count} kulüp, en az ` +
          `${league.minClubs} bekleniyordu) — beklenen "${league.name}"`,
      );
      ok = false;
    } else {
      lines.push(
        `  ✓ ${league.wikidataId} ${league.name.padEnd(16)} ${count} kulüp`,
      );
    }
  }

  return { ok, lines };
}

/**
 * Varlıkların Vikipedi makale adlarını SPARQL üzerinden toplar (§4.3).
 *
 * Hem oyuncular hem kulüpler için kullanılır; ikisinde de aynı sorgu, aynı
 * grup boyutu. Makalesi olmayan varlık sonuçta HİÇ görünmez — "makalesi yok"
 * ile "boş makale" ayrımını çağıranın yapmasına gerek kalmaz.
 */
async function fetchArticleTitles(
  client: WikidataClient,
  qids: readonly string[],
  label: string,
  noCache: boolean,
): Promise<Map<string, ArticleTitles>> {
  const result = new Map<string, ArticleTitles>();

  for (let i = 0; i < qids.length; i += PLAYER_BATCH_SIZE) {
    const batch = qids.slice(i, i + PLAYER_BATCH_SIZE);
    const bindings = await client.query(wikipediaArticles(batch), {
      label: `articles-${label}-${i / PLAYER_BATCH_SIZE}-${batch.length}`,
      noCache,
    });

    for (const binding of bindings) {
      const id = qid(binding, "item");
      if (id === undefined) continue;

      const titles: ArticleTitles = {};
      for (const [site, key] of [
        ["tr", "trArticle"],
        ["en", "enArticle"],
      ] as const) {
        const url = str(binding, key);
        if (url === undefined) continue;

        const title = articleTitleFromUrl(url);
        if (title !== null) titles[site] = title;
      }

      if (Object.keys(titles).length > 0) result.set(id, titles);
    }
  }

  return result;
}

export async function extractDataset(
  client: WikidataClient,
  wikipedia: WikipediaClient,
  options: ExtractOptions = {},
): Promise<ExtractedDataset> {
  const noCache = options.noCache ?? false;

  // ─── 1. Ligdeki kulüpler ──────────────────────────────────────────────
  console.log("\n[1/5] Kulüpler çekiliyor…");
  const clubs: NormalizedClub[] = [];

  for (const league of TARGET_LEAGUES) {
    // Üç kaynak ADAY üretir; hangisinin gerçek kulüp olduğuna burada karar
    // verilmez. Kararı aşağıdaki `MIN_SPELLS_FOR_SELECTABLE` eşiği ölçülen
    // dönem sayısına bakarak verir (gerekçe: queries.ts → clubsFromSeasonParents).
    for (const [source, sparql] of [
      ["link", clubsByLeagueLink(league.wikidataId)],
      ["seasons", clubsFromSeasons(league.wikidataId)],
      ["parents", clubsFromSeasonParents(league.wikidataId)],
    ] as const) {
      const bindings = await client.query(sparql, {
        label: `clubs-${source}-${league.wikidataId}`,
        noCache,
      });

      for (const binding of bindings) {
        const club = toClub(binding, league.wikidataId);
        if (club !== null) clubs.push(club);
      }
    }
  }

  // Aynı kulüp birden çok ligde görünebilir (tarihsel P118 kayıtları).
  const uniqueClubs = dedupeBy(clubs, (c) => c.wikidataId);
  console.log(`      ${uniqueClubs.length} benzersiz kulüp`);

  const targetClubs =
    options.maxClubs === undefined
      ? uniqueClubs
      : uniqueClubs.slice(0, options.maxClubs);

  // ─── 2. Kulüplerdeki dönemler ─────────────────────────────────────────
  console.log(`\n[2/5] ${targetClubs.length} kulübün dönemleri çekiliyor…`);
  const spells: NormalizedSpell[] = [];

  for (const [index, club] of targetClubs.entries()) {
    const isYouth = looksLikeYouthOrReserve(club.name);
    const bindings = await client.query(spellsAtClub(club.wikidataId), {
      label: `spells-${club.wikidataId}`,
      noCache,
    });

    for (const binding of bindings) {
      const spell = toSpell(binding, club.wikidataId, isYouth);
      if (spell !== null) spells.push(spell);
    }

    console.log(
      `      [${index + 1}/${targetClubs.length}] ${club.shortName}: ` +
        `toplam ${spells.length} dönem`,
    );
  }

  // Bu koşuda dönemleri fiilen çekilen kulüpler; kısmi koşuda (`--max-clubs`)
  // hepsi değildir ve çağıran bunu bilmek zorundadır.
  const fetchedClubIds = new Set(targetClubs.map((c) => c.wikidataId));

  // ELLE DÜZELTME YOK ve bu bilinçli (§4.3). Kaynakta olmayan bir dönemi elle
  // eklemek, veri kümesini insan emeğine bağımlı kılıyordu: her transfer
  // döneminde birinin oturup eksikleri bulması gerekirdi. Kapsam boşlukları
  // ikinci bir KAYNAKLA kapatılır, elle değil — böylece veri kümesi kendini
  // güncel tutabilir.
  const uniqueSpells = dedupeBy(spells, (s) => s.wikidataStatementId);

  // ─── 3. Oyuncu meta verisi ────────────────────────────────────────────
  const playerIds = [...new Set(uniqueSpells.map((s) => s.playerWikidataId))];
  const batches = Math.ceil(playerIds.length / PLAYER_BATCH_SIZE);
  console.log(
    `\n[3/5] ${playerIds.length} oyuncunun bilgisi çekiliyor (${batches} grup)…`,
  );

  const players: NormalizedPlayer[] = [];
  for (let i = 0; i < playerIds.length; i += PLAYER_BATCH_SIZE) {
    const batch = playerIds.slice(i, i + PLAYER_BATCH_SIZE);
    const bindings = await client.query(playerDetails(batch), {
      label: `players-${i / PLAYER_BATCH_SIZE}-${batch.length}`,
      noCache,
    });

    for (const binding of bindings) {
      const player = toPlayer(binding);
      if (player !== null) players.push(player);
    }
  }

  // ─── 4. Oyuncu istatistikleri (§9.2) ──────────────────────────────────
  //
  // AYRI GEÇİŞ, `playerDetails`'e eklenmedi. İki gerekçe, ikisi de ölçüldü:
  //   · Millî maç sorgusu ifade başına satır döndürür, oyuncu başına değil;
  //     tek sorguda birleştirmek kartezyen çarpım üretir.
  //   · `VALUES` bloğunu iki kez yazdırmak URL'i `HTTP 414`'e taşıyor.
  //
  // Millî takım listesi BİR KEZ çekilir; süzme bellekte yapılır. Sorgunun
  // içinde sınıf denetimi yapmak aynı işi ~9,5 saate çıkarıyordu (§9.2).
  console.log(`\n[4/5] Oyuncu istatistikleri (millî maç, boy, kilo)…`);

  const teamBindings = await client.query(mensNationalTeams(), {
    label: "national-teams",
    noCache,
  });
  const nationalTeamIds = new Set(
    teamBindings
      .map((binding) => qid(binding, "team"))
      .filter((id): id is string => id !== undefined),
  );
  console.log(`      ${nationalTeamIds.size} erkek millî takım`);

  const caps = new Map<string, number>();
  const physical = new Map<
    string,
    { heightCm: number | null; weightKg: number | null }
  >();

  for (let i = 0; i < playerIds.length; i += PLAYER_BATCH_SIZE) {
    const batch = playerIds.slice(i, i + PLAYER_BATCH_SIZE);
    const group = i / PLAYER_BATCH_SIZE;

    const capsBindings = await client.query(playerStats(batch), {
      label: `player-caps-${group}-${batch.length}`,
      noCache,
    });
    for (const [player, value] of nationalCapsFrom(capsBindings, (team) =>
      nationalTeamIds.has(team),
    )) {
      caps.set(player, value);
    }

    const physicalBindings = await client.query(playerPhysical(batch), {
      label: `player-physical-${group}-${batch.length}`,
      noCache,
    });
    for (const [player, value] of physicalFrom(physicalBindings)) {
      physical.set(player, value);
    }
  }

  const playersWithStats = applyPlayerStats(players, caps, physical);
  const sizes = [...physical.values()];
  console.log(
    `      millî maç ${caps.size} · ` +
      `boy ${sizes.filter((p) => p.heightCm !== null).length} · ` +
      `kilo ${sizes.filter((p) => p.weightKg !== null).length}`,
  );

  // ─── Kapsam filtresi: erkek ligleri ───────────────────────────────────
  // Kapsam dışı oyuncular ve dönemleri burada, ayıklama adımından ÖNCE
  // çıkarılır. Aksi hâlde dönemleri "öksüz kayıt" sayılıp §8.2'deki ayıklama
  // oranını şişirir ve bilinçli bir kapsam kararı veri hatası gibi görünürdü.
  const uniquePlayers = dedupeBy(playersWithStats, (p) => p.wikidataId);
  const inScopePlayers = uniquePlayers.filter(isInScope);
  const inScopeIds = new Set(inScopePlayers.map((p) => p.wikidataId));

  const excludedCount = uniquePlayers.length - inScopePlayers.length;
  const scopedSpells = uniqueSpells.filter((s) =>
    inScopeIds.has(s.playerWikidataId),
  );

  console.log(
    `      kapsam: ${inScopePlayers.length} oyuncu ` +
      `(${excludedCount} kadın futbolcu kapsam dışı), ` +
      `${scopedSpells.length} dönem`,
  );

  // ─── 5. Vikipedi katmanı (§4.3) ───────────────────────────────────────
  //
  // KAPSAM FİLTRESİNDEN SONRA. Kapsam dışı oyuncuların makalelerini çekmek
  // hem gereksiz istek hem de sonradan atılacak dönem üretirdi.
  //
  // Kulüp evreni ve oyuncu kimlikleri Wikidata'dan gelir; Vikipedi yalnızca
  // eksikleri doldurur (kural 5). Bu yüzden geçiş EN SONDA durur — omurga
  // tamamlanmadan tamamlayıcı katman çalıştırılamaz.
  const clubIds = new Set(uniqueClubs.map((c) => c.wikidataId));
  const youthClubIds = new Set(
    uniqueClubs
      .filter((c) => looksLikeYouthOrReserve(c.name))
      .map((c) => c.wikidataId),
  );

  let finalSpells = scopedSpells;

  if (options.skipWikipedia === true) {
    console.log("\n[5/5] Vikipedi katmanı atlandı (--skip-wikipedia).");
  } else {
    console.log(`\n[5/5] Vikipedi bilgi kutuları okunuyor (§4.3)…`);

    // Makale adları SPARQL'den gelir, MediaWiki'den değil: 250'lik gruplar
    // 50'lik uçların beşte biri kadar istekle aynı bilgiyi veriyor.
    const playerArticles = await fetchArticleTitles(
      client,
      inScopePlayers.map((p) => p.wikidataId),
      "players",
      noCache,
    );
    const clubArticles = await fetchArticleTitles(
      client,
      uniqueClubs.map((c) => c.wikidataId),
      "clubs",
      noCache,
    );

    const pass = await collectWikipediaSpells(wikipedia, {
      playerArticles,
      clubArticles,
      noCache,
    });

    console.log(
      `      makale: ${pass.stats.playersWithArticle}/${inScopePlayers.length} oyuncu · ` +
        `tr ${pass.stats.articlesBySite.tr} · en ${pass.stats.articlesBySite.en} · ` +
        `${pass.stats.clubTitlesIndexed} kulüp adı indekslendi`,
    );
    console.log(
      `      ${pass.stats.parsedRows} kariyer satırı okundu · ` +
        `${pass.stats.duplicateRows} ikinci dil kopyası · ` +
        `${pass.stats.unmatchedClubLinks} satır evrendeki bir kulübe bağlanamadı`,
    );

    const merged = mergeWikipediaSpells({
      spells: scopedSpells,
      wikipedia: pass.spells,
      clubIds,
      isYouthClub: (id) => youthClubIds.has(id),
    });
    finalSpells = merged.spells;

    const s = merged.stats;
    console.log(
      `      +${s.added} yeni dönem · ${s.enriched} dönem zenginleşti · ` +
        `${s.overridden} değer düzeltildi`,
    );
    console.log(
      `      atlandı: ${s.skippedOutOfUniverse} kapsam dışı kulüp · ` +
        `${s.skippedAmbiguous} belirsiz eşleşme · ${s.skippedNoYear} yılsız · ` +
        `${s.rejectedYearConflict} tutarsız + ${s.rejectedYearCollision} çakışan yıl · ` +
        `${s.rejectedTallyConflict} tutarsız maç/gol`,
    );
  }

  // ─── Seçim listesi küratörlüğü ────────────────────────────────────────
  //
  // BİRLEŞTİRMEDEN SONRA hesaplanır: Vikipedi'nin eklediği dönemler bir
  // kulübü eşiğin üstüne taşıyabilir ve o kulüp artık seçilebilir olmalıdır.
  // Yalnızca anlamlı sayıda dönem kaydı olan kulüpler listeye girer; aksi
  // hâlde `P118` üzerinden gelen feshedilmiş selef kulüpler (SC Fives,
  // Olympique Lillois…) listede görünüp boş sonuç döndürürdü.
  const spellCountByClub = new Map<string, number>();
  for (const spell of finalSpells) {
    spellCountByClub.set(
      spell.clubWikidataId,
      (spellCountByClub.get(spell.clubWikidataId) ?? 0) + 1,
    );
  }

  const selectableClubIds = new Set(
    targetClubs
      .filter(
        (c) =>
          (spellCountByClub.get(c.wikidataId) ?? 0) >=
          MIN_SPELLS_FOR_SELECTABLE,
      )
      .map((c) => c.wikidataId),
  );
  console.log(
    `\n      ${selectableClubIds.size}/${targetClubs.length} kulüp seçilebilir ` +
      `(en az ${MIN_SPELLS_FOR_SELECTABLE} dönem kaydı olanlar)`,
  );

  return {
    clubs: uniqueClubs,
    players: inScopePlayers,
    spells: finalSpells,
    selectableClubIds,
    fetchedClubIds,
  };
}
