import { MIN_SPELLS_FOR_SELECTABLE, TARGET_LEAGUES } from "../leagues";
import type { WikidataClient } from "../sources/wikidata/client";
import {
  PLAYER_BATCH_SIZE,
  clubsByLeagueLink,
  clubsFromSeasonParents,
  clubsFromSeasons,
  playerDetails,
  spellsAtClub,
  verifyLeagues,
} from "../sources/wikidata/queries";
import { int, qid, str } from "../sources/wikidata/schemas";
import {
  dedupeBy,
  isInScope,
  looksLikeYouthOrReserve,
  toClub,
  toPlayer,
  toSpell,
  type NormalizedClub,
  type NormalizedPlayer,
  type NormalizedSpell,
} from "./normalize";

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

export async function extractDataset(
  client: WikidataClient,
  options: ExtractOptions = {},
): Promise<ExtractedDataset> {
  const noCache = options.noCache ?? false;

  // ─── 1. Ligdeki kulüpler ──────────────────────────────────────────────
  console.log("\n[1/3] Kulüpler çekiliyor…");
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
  console.log(`\n[2/3] ${targetClubs.length} kulübün dönemleri çekiliyor…`);
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

  const uniqueSpells = dedupeBy(spells, (s) => s.wikidataStatementId);

  // Seçim listesi küratörlüğü: yalnızca anlamlı sayıda dönem kaydı olan
  // kulüpler seçilebilir olur. Aksi hâlde `P118` üzerinden gelen feshedilmiş
  // selef kulüpler (SC Fives, Olympique Lillois…) listede görünüp boş sonuç
  // döndürürdü.
  const spellCountByClub = new Map<string, number>();
  for (const spell of uniqueSpells) {
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
    `      ${selectableClubIds.size}/${targetClubs.length} kulüp seçilebilir ` +
      `(en az ${MIN_SPELLS_FOR_SELECTABLE} dönem kaydı olanlar)`,
  );

  // ─── 3. Oyuncu meta verisi ────────────────────────────────────────────
  const playerIds = [...new Set(uniqueSpells.map((s) => s.playerWikidataId))];
  const batches = Math.ceil(playerIds.length / PLAYER_BATCH_SIZE);
  console.log(
    `\n[3/3] ${playerIds.length} oyuncunun bilgisi çekiliyor (${batches} grup)…`,
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

  // ─── Kapsam filtresi: erkek ligleri ───────────────────────────────────
  // Kapsam dışı oyuncular ve dönemleri burada, ayıklama adımından ÖNCE
  // çıkarılır. Aksi hâlde dönemleri "öksüz kayıt" sayılıp §8.2'deki ayıklama
  // oranını şişirir ve bilinçli bir kapsam kararı veri hatası gibi görünürdü.
  const uniquePlayers = dedupeBy(players, (p) => p.wikidataId);
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

  return {
    clubs: uniqueClubs,
    players: inScopePlayers,
    spells: scopedSpells,
    selectableClubIds,
    fetchedClubIds: new Set(targetClubs.map((c) => c.wikidataId)),
  };
}
