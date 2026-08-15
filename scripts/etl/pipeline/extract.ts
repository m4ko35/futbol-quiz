import { MIN_SPELLS_FOR_SELECTABLE, TARGET_LEAGUES } from "../leagues";
import type { WikidataClient } from "../sources/wikidata/client";
import {
  articleTitleFromUrl,
  NATIVE_SITES,
  PRIMARY_SITES,
  WIKI_SITES,
  type ArticleTitles,
  type WikipediaClient,
  type WikiSite,
} from "../sources/wikipedia/client";
import {
  PLAYER_BATCH_SIZE,
  clubsByLeagueLink,
  clubsFromSeasonParents,
  clubsFromSeasons,
  clubDuplicates,
  mensNationalTeams,
  playerDetails,
  playerPhysical,
  playerStats,
  spellsAtClub,
  verifyLeagues,
  wikipediaArticles,
} from "../sources/wikidata/queries";
import { int, qid, str, type SparqlBinding } from "../sources/wikidata/schemas";
import type { CareerTotal } from "../sources/wikipedia/career-total";
import { checkCareerTotals } from "./career-total-check";
import { disambiguateShortNames } from "./club-labels";
import { mergeDuplicateClubs } from "./merge-clubs";
import { findContradictions } from "./cross-check";
import type { Contradiction } from "./cross-check";
import { mergeWikipediaSpells } from "./merge-wikipedia";
import {
  applyPlayerStats,
  dedupeBy,
  isInScope,
  looksLikeYouthOrReserve,
  nationalCapsFrom,
  nationalTeamCountriesFrom,
  physicalFrom,
  playersFrom,
  toClub,
  toSpell,
  type NationalTeamCaps,
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
  /**
   * BR-42 — Vikipedi'nin çürüttüğü Wikidata dönemleri.
   *
   * Vikipedi katmanı atlandıysa BOŞ kalır; o koşuda ikinci kaynak yoktur ve
   * "çelişki yok" ile "sorulamadı" karıştırılmamalıdır.
   */
  readonly contradictions: Contradiction[];
  /**
   * §9.2 — kulüp kariyerinin tamamı (lig + kupa + Avrupa), oyuncu QID başına.
   *
   * Yalnızca çapraz denetimi GEÇEN kayıtlar burada. Vikipedi katmanı
   * atlandıysa boş kalır — "toplamı yok" ile "sorulmadı" ayrı şeylerdir.
   */
  readonly careerTotals: ReadonlyMap<string, CareerTotal>;
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
      label
        .toLowerCase()
        .includes(
          (league.verifyLabel ?? league.name).toLowerCase().slice(0, 6),
        );

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
 *
 * SORULAN DİLLER ÇAĞIRANDAN GELİR: her dil ayrı bir `OPTIONAL` birleştirmesi,
 * yani sorgunun maliyeti dil sayısıyla artar (§4.3, Aşama 2).
 */
async function fetchArticleTitles(
  client: WikidataClient,
  qids: readonly string[],
  label: string,
  noCache: boolean,
  sites: readonly WikiSite[],
): Promise<Map<string, ArticleTitles>> {
  const result = new Map<string, ArticleTitles>();

  for (let i = 0; i < qids.length; i += PLAYER_BATCH_SIZE) {
    const batch = qids.slice(i, i + PLAYER_BATCH_SIZE);
    const bindings = await client.query(wikipediaArticles(batch, sites), {
      label: `articles-${label}-${i / PLAYER_BATCH_SIZE}-${batch.length}`,
      noCache,
    });

    for (const binding of bindings) {
      const id = qid(binding, "item");
      if (id === undefined) continue;

      const titles: ArticleTitles = {};
      for (const site of sites) {
        const url = str(binding, `${site}Article`);
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
  const deduped = dedupeBy(spells, (s) => s.wikidataStatementId);

  // ─── 2b. Kulüp ikizlerini birleştir (§5.3) ────────────────────────────
  //
  // BURADA, oyuncu geçişinden ÖNCE: gölge kulübün dönemleri asıl kulübe
  // taşınmadan oyuncu listesi çıkarılırsa, yalnızca gölgede dönemi olan
  // oyuncular sonraki adımların dışında kalırdı.
  /**
   * YIĞINLANIR — ölçülmüş bir sınır yüzünden.
   *
   * Sorgu tüm kulüp QID'lerini tek `VALUES` bloğuna koyuyordu ve kulüp evreni
   * 617'ye çıkınca `HTTP 414: Request-URI Too Large` ile düştü. Sınır yeni
   * değil, zaten kayıtlı: oyuncu sorguları da aynı sebeple 250'lik yığınlarda
   * soruluyor (500'de 414 — `queries.ts`).
   *
   * YIĞINLAMA BURADA GÜVENLİ ve bu tesadüf değil: sorgu her kulübü BAĞIMSIZ
   * değerlendiriyor, `?parent` ucu `VALUES` ile sınırlı değil. Evren dışına
   * işaret eden bağları `mergeDuplicateClubs` zaten eliyor. Yığınlar arası bir
   * çifti kaçırma riski YOK.
   */
  const duplicateBindings: SparqlBinding[] = [];
  const clubQids = uniqueClubs.map((c) => c.wikidataId);
  for (let i = 0; i < clubQids.length; i += PLAYER_BATCH_SIZE) {
    const batch = clubQids.slice(i, i + PLAYER_BATCH_SIZE);
    duplicateBindings.push(
      ...(await client.query(clubDuplicates(batch), {
        label: `club-duplicates-${String(i / PLAYER_BATCH_SIZE)}`,
        noCache,
      })),
    );
  }

  const clubMerge = mergeDuplicateClubs({
    clubs: uniqueClubs,
    spells: deduped,
    links: duplicateBindings.flatMap((b) => {
      const club = qid(b, "club");
      const parent = qid(b, "parent");
      return club === undefined || parent === undefined
        ? []
        : [{ clubWikidataId: club, parentWikidataId: parent }];
    }),
  });

  const uniqueSpells = clubMerge.spells;

  // ─── 2c. Seçicide ayırt edilebilir kısa ad (§5.3) ─────────────────────
  //
  // BİRLEŞTİRMEDEN SONRA: 2b'nin kapattığı ikizler zaten tek satıra indi,
  // önce çalıştırılsaydı sonradan yok olacak kulüpler için ad uzatırdı.
  // Geriye kalan çakışmalar GERÇEKTEN ayrı kulüplerdir (Toulouse 1937 / 1970)
  // ve birleştirilemezler — çözüm gösterimde, veride değil.
  const labelled = disambiguateShortNames(clubMerge.clubs);
  const mergedClubs = labelled.clubs;

  if (labelled.stats.collidingGroups > 0) {
    const s2 = labelled.stats;
    console.log(
      `      ${s2.collidingGroups} kısa ad çakışması · ` +
        `${s2.renamed} kulüp ayırt edici ad aldı`,
    );
  }
  for (const label of labelled.stats.unresolved) {
    // Ayırt edilemeyen çakışma = kaynakta birleştirilmesi gereken ikiz (§5.3).
    console.log(`      UYARI: "${label}" iki kulüpte de aynı görünüyor`);
  }

  if (clubMerge.stats.mergedClubs > 0) {
    const s = clubMerge.stats;
    console.log(
      `      ${s.mergedClubs} kulüp ikizi birleştirildi · ` +
        `+${s.movedSpells} dönem taşındı · ` +
        `${s.droppedIdentical} birebir kopya + ${s.droppedOverlapping} örtüşen atıldı`,
    );
  }

  // ─── 3. Oyuncu meta verisi ────────────────────────────────────────────
  const playerIds = [...new Set(uniqueSpells.map((s) => s.playerWikidataId))];
  const batches = Math.ceil(playerIds.length / PLAYER_BATCH_SIZE);
  console.log(
    `\n[3/5] ${playerIds.length} oyuncunun bilgisi çekiliyor (${batches} grup)…`,
  );

  // Bağlamalar OYUNCU BAŞINA TOPLANIR (§5.3.1). `playerDetails` çok değerli
  // alanlar yüzünden oyuncu başına birden çok satır döndürüyor; eski kod her
  // satırı ayrı kayıt yapıp diziye ekliyordu ve yükleyicide SONUNCUSU
  // kazanıyordu — Messi bu yüzden İspanyol görünüyordu.
  const players: NormalizedPlayer[] = [];
  for (let i = 0; i < playerIds.length; i += PLAYER_BATCH_SIZE) {
    const batch = playerIds.slice(i, i + PLAYER_BATCH_SIZE);
    const bindings = await client.queryBatch(batch, playerDetails, {
      label: `players-${i / PLAYER_BATCH_SIZE}-${batch.length}`,
      noCache,
    });

    players.push(...playersFrom(bindings));
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
  // Takımın ülkesi BR-38'in birinci kademesi: uyruk buradan seçiliyor.
  const nationalTeamCountries = nationalTeamCountriesFrom(teamBindings);
  console.log(
    `      ${nationalTeamIds.size} erkek millî takım · ` +
      `${nationalTeamCountries.size} tanesinin ülke kodu var`,
  );

  const caps = new Map<string, NationalTeamCaps>();
  const physical = new Map<
    string,
    { heightCm: number | null; weightKg: number | null }
  >();

  for (let i = 0; i < playerIds.length; i += PLAYER_BATCH_SIZE) {
    const batch = playerIds.slice(i, i + PLAYER_BATCH_SIZE);
    const group = i / PLAYER_BATCH_SIZE;

    const capsBindings = await client.queryBatch(batch, playerStats, {
      label: `player-caps-${group}-${batch.length}`,
      noCache,
    });
    for (const [player, value] of nationalCapsFrom(capsBindings, (team) =>
      nationalTeamIds.has(team),
    )) {
      caps.set(player, value);
    }

    const physicalBindings = await client.queryBatch(batch, playerPhysical, {
      label: `player-physical-${group}-${batch.length}`,
      noCache,
    });
    for (const [player, value] of physicalFrom(physicalBindings)) {
      physical.set(player, value);
    }
  }

  const playersWithStats = applyPlayerStats(
    players,
    caps,
    physical,
    nationalTeamCountries,
  );
  const sizes = [...physical.values()];
  console.log(
    `      millî maç ${caps.size} · ` +
      `boy ${sizes.filter((p) => p.heightCm !== null).length} · ` +
      `kilo ${sizes.filter((p) => p.weightKg !== null).length}`,
  );

  // BR-38'in kademeleri ölçülüyor: hangi sinyalin kaç oyuncuyu kapsadığı,
  // bir sonraki koşuda kuralın işe yarayıp yaramadığını söyleyen tek sayı.
  const multi = playersWithStats.filter((p) => p.citizenships.length > 1);
  const multiWithTeam = multi.filter((p) => caps.has(p.wikidataId));
  console.log(
    `      uyruk (BR-38): çok vatandaşlıklı ${multi.length} · ` +
      `bunlardan millî takımı olan ${multiWithTeam.length}`,
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
  const clubIds = new Set(mergedClubs.map((c) => c.wikidataId));
  const youthClubIds = new Set(
    mergedClubs
      .filter((c) => looksLikeYouthOrReserve(c.name))
      .map((c) => c.wikidataId),
  );

  let finalSpells = scopedSpells;
  /**
   * BR-42 — çapraz kaynak çelişkileri.
   *
   * Vikipedi katmanı atlanırsa BOŞ kalır ve bu bilinçli: ikinci kaynak
   * okunmadığında "çelişki yok" demek, sorulmamış bir soruya cevap uydurmak
   * olurdu (§2.7).
   */
  let contradictions: Contradiction[] = [];
  /** §9.2 — çapraz denetimi geçen kulüp kariyer toplamları. */
  let careerTotals: ReadonlyMap<string, CareerTotal> = new Map();

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
      PRIMARY_SITES,
    );

    // ANA DİLLER YALNIZCA BOŞLUK İÇİN (§4.3, Aşama 2). tr/en makalesi olan
    // oyuncuya it/de/fr sormak, satırlarının %88-96'sı zaten Wikidata'da
    // olduğu için isteğin çoğunu kopya veriye harcardı.
    const gapPlayers = inScopePlayers
      .map((p) => p.wikidataId)
      .filter((id) => !playerArticles.has(id));

    console.log(
      `      ${gapPlayers.length} oyuncunun tr/en makalesi yok — ` +
        `ana diller (${NATIVE_SITES.join("/")}) bunlar için soruluyor…`,
    );

    const nativeArticles = await fetchArticleTitles(
      client,
      gapPlayers,
      "players-native",
      noCache,
      NATIVE_SITES,
    );
    for (const [id, titles] of nativeArticles) {
      // Boşluktaki oyuncularda tr/en zaten yok; birleştirme çakışmaz.
      playerArticles.set(id, { ...playerArticles.get(id), ...titles });
    }

    // Kulüpler her dilde sorulur: ana dil kutusundaki bağlantıyı evrenle
    // eşleştirmenin tek yolu o dildeki kulüp makale adı. ~400 kulüp = 2 sorgu.
    const clubArticles = await fetchArticleTitles(
      client,
      mergedClubs.map((c) => c.wikidataId),
      "clubs",
      noCache,
      WIKI_SITES,
    );

    const pass = await collectWikipediaSpells(wikipedia, {
      playerArticles,
      clubArticles,
      noCache,
    });

    console.log(
      `      makale: ${pass.stats.playersWithArticle}/${inScopePlayers.length} oyuncu · ` +
        WIKI_SITES.map((s) => `${s} ${pass.stats.articlesBySite[s]}`).join(
          " · ",
        ) +
        ` · ${pass.stats.clubTitlesIndexed} kulüp adı indekslendi`,
    );
    console.log(
      `      ${pass.stats.parsedRows} kariyer satırı okundu · ` +
        `${pass.stats.duplicateRows} ikinci dil kopyası · ` +
        `${pass.stats.unmatchedClubLinks} satır evrendeki bir kulübe bağlanamadı`,
    );
    console.log(
      "      dil başına satır (evrene düşen): " +
        WIKI_SITES.map((s) => {
          const rows = pass.stats.rowsBySite[s];
          const hit = pass.stats.matchedBySite[s];
          const pct = rows === 0 ? 0 : Math.round((hit / rows) * 100);
          return `${s} ${rows} (${hit}, %${pct})`;
        }).join(" · "),
    );

    const merged = mergeWikipediaSpells({
      spells: scopedSpells,
      wikipedia: pass.spells,
      clubIds,
      isYouthClub: (id) => youthClubIds.has(id),
    });
    finalSpells = merged.spells;

    /*
      BR-42 — çapraz kaynak denetimi.

      BİRLEŞTİRMEDEN SONRA koşuyor ve bu sıra önemli: birleştirme, Vikipedi'nin
      doğruladığı dönemleri zenginleştirir, yani buraya kalan uyuşmazlıklar
      gerçekten uyuşmayanlardır. Önce koşsaydı, birleştirmenin kapatacağı
      farkları çelişki diye sayardı.

      Denetim SİLMEZ; kararı `validateDataset` verir (§4.3'ün 4. kuralı).
    */
    contradictions = findContradictions({
      spells: finalSpells,
      wikipedia: pass.spells,
    });
    console.log(
      contradictions.length === 0
        ? "      ✓ çapraz kaynak denetimi temiz (BR-42)"
        : `      ✗ ${contradictions.length} dönemde Vikipedi ile Wikidata AYNI YILLAR için farklı kulüp söylüyor (BR-42)`,
    );

    /*
      §9.2 — kulüp kariyer toplamı, kendi lig sayımızla karşılaştırılır.

      BİRLEŞTİRMEDEN SONRA koşuyor, BR-42 ile aynı gerekçeyle: kıyas ölçüsü
      `finalSpells` olmalı, çünkü Vikipedi katmanı maç/gol değerlerini
      zenginleştiriyor. Önce koşsaydı kapı, birleştirmenin kapatacağı farkları
      çelişki sayardı.

      BU KAPI SİLER, raporlamakla kalmaz — ve BR-42'den ayrıldığı yer burası.
      Orada bulunan şey "iki kaynağın anlaşamadığı kayıt"tı ve kararı insan
      vermeliydi. Burada bulunan şey ARİTMETİK OLARAK İMKÂNSIZ: bütünü
      kapsayan sayı parçasından küçük olamaz. İnsana sorulacak bir yanı yok.
    */
    const checked = checkCareerTotals({
      careerTotals: pass.careerTotals,
      spells: finalSpells,
    });
    careerTotals = checked.accepted;

    const missed = pass.stats.careerTotalsMissed;
    const read = pass.stats.careerTotalsParsed;
    console.log(
      `      kariyer toplamı: ${read} okundu · ${missed} makale okunamadı · ` +
        `${checked.conflicts.length} kayıt lig sayımızdan KÜÇÜK çıktı ve düştü`,
    );
    for (const conflict of checked.conflicts.slice(0, 5)) {
      console.log(
        `        ${conflict.playerWikidataId}: toplam ` +
          `${conflict.parsed.appearances}/${conflict.parsed.goals} < lig ` +
          `${conflict.leagueAppearances}/${conflict.leagueGoals} (${conflict.reason})`,
      );
    }

    const s = merged.stats;
    console.log(
      `      +${s.added} yeni dönem · ${s.enriched} dönem zenginleşti · ` +
        `${s.overridden} değer düzeltildi · ` +
        `${s.matchedByEvidence} kanıtsız dönem kanıtlı okumaya bırakıldı`,
    );
    console.log(
      `      atlandı: ${s.skippedOutOfUniverse} kapsam dışı kulüp · ` +
        `${s.skippedAmbiguous} belirsiz eşleşme · ${s.skippedNoYear} yılsız · ` +
        `${s.rejectedYearConflict} tutarsız + ${s.rejectedYearCollision} çakışan yıl · ` +
        `${s.rejectedTallyConflict} tutarsız maç/gol`,
    );
    console.log(
      `      BR-22: ${s.disputedTallyRestored} gol kaydı ikinci kaynakla ` +
        `doğrulanıp korundu · ${s.disputedTallyDropped} doğrulanamayıp düşürüldü`,
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

  // Gölge kulüpler listeden çıktı; aday havuzu birleştirilmiş evrenin
  // dönemleri çekilmiş kısmıdır.
  const candidateClubs = mergedClubs.filter((c) =>
    fetchedClubIds.has(c.wikidataId),
  );

  const selectableClubIds = new Set(
    candidateClubs
      .filter(
        (c) =>
          (spellCountByClub.get(c.wikidataId) ?? 0) >=
          MIN_SPELLS_FOR_SELECTABLE,
      )
      .map((c) => c.wikidataId),
  );
  console.log(
    `\n      ${selectableClubIds.size}/${candidateClubs.length} kulüp seçilebilir ` +
      `(en az ${MIN_SPELLS_FOR_SELECTABLE} dönem kaydı olanlar)`,
  );

  return {
    clubs: mergedClubs,
    players: inScopePlayers,
    spells: finalSpells,
    selectableClubIds,
    fetchedClubIds,
    contradictions,
    careerTotals,
  };
}
