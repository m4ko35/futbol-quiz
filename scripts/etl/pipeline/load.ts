import { PrismaClient } from "../../../src/generated/prisma";
import type { LeagueSeed } from "../leagues";
import type {
  NormalizedClub,
  NormalizedPlayer,
  NormalizedSpell,
} from "./normalize";

/**
 * Normalize edilmiş veriyi SQLite'a yazar (PROJECT.md §4.2).
 *
 * Yükleme İDEMPOTENTTİR: aynı veriyle ikinci kez çalıştırmak satır çoğaltmaz.
 * Bunu Wikidata'nın kendi kimlikleri sağlıyor — kulüp/oyuncu için QID, dönem
 * için ifade (statement) kimliği.
 */

/**
 * SQLite'ın bağlı değişken sınırına takılmamak için parça boyutu.
 * Dönem kaydı ~10 alan taşıyor: 500 × 10 = 5000 değişken, sınırın altında.
 */
const CHUNK_SIZE = 500;

export interface LoadResult {
  readonly leagues: number;
  readonly clubs: number;
  readonly players: number;
  readonly spells: number;
  readonly skippedSpells: number;
  /** Kapsam daraldığı için artık dönemi kalmayan, silinen oyuncular. */
  readonly removedStalePlayers: number;
  /** Hiç dönem kaydı olmayan, seçilemez kulüpler. */
  readonly removedEmptyClubs: number;
}

export async function loadDataset(
  prisma: PrismaClient,
  input: {
    readonly leagues: readonly LeagueSeed[];
    readonly clubs: readonly NormalizedClub[];
    readonly players: readonly NormalizedPlayer[];
    readonly spells: readonly NormalizedSpell[];
    /** Seçim listesinde görünecek kulüpler (§1.3). */
    readonly selectableClubIds: ReadonlySet<string>;
    /**
     * Bu koşu kulüp evreninin TAMAMINI mı kapsıyor?
     *
     * `true` ise yükleme otoriterdir: gelen kümede olmayan kulüpler silinir.
     * Bu olmadan, kulüp evreni değiştiğinde (ör. sorgu düzeltilip kulüp sayısı
     * 129'dan 376'ya çıktığında) eski koşudan kalan kulüpler dönemleriyle
     * birlikte veritabanında kalıyor ve sayımlar gerçeği yansıtmıyordu.
     *
     * Kısmi koşularda (`--max-clubs`) `false` olmalıdır — aksi hâlde 3 kulüplük
     * bir deneme koşusu tüm veritabanını silerdi.
     */
    readonly isFullRun: boolean;
  },
): Promise<LoadResult> {
  // ─── Ligler ───────────────────────────────────────────────────────────
  const leagueIdByQid = new Map<string, string>();
  for (const league of input.leagues) {
    const row = await prisma.league.upsert({
      where: { wikidataId: league.wikidataId },
      create: {
        wikidataId: league.wikidataId,
        name: league.name,
        country: league.country,
        tier: league.tier,
      },
      update: { name: league.name, country: league.country, tier: league.tier },
    });
    leagueIdByQid.set(league.wikidataId, row.id);
  }

  // ─── Kulüpler ─────────────────────────────────────────────────────────
  const clubIdByQid = new Map<string, string>();
  for (const chunk of chunked(input.clubs, CHUNK_SIZE)) {
    await prisma.$transaction(
      chunk.map((club) => {
        const data = {
          name: club.name,
          shortName: club.shortName,
          searchKey: club.searchKey,
          country: club.country,
          foundedYear: club.foundedYear,
          crestUrl: club.crestUrl,
          isSelectable: input.selectableClubIds.has(club.wikidataId),
          leagueId: leagueIdByQid.get(club.leagueWikidataId ?? "") ?? null,
        };
        return prisma.club.upsert({
          where: { wikidataId: club.wikidataId },
          create: { wikidataId: club.wikidataId, ...data },
          update: data,
        });
      }),
    );
  }
  for (const row of await prisma.club.findMany({
    select: { id: true, wikidataId: true },
  })) {
    clubIdByQid.set(row.wikidataId, row.id);
  }

  // ─── Oyuncular ────────────────────────────────────────────────────────
  for (const chunk of chunked(input.players, CHUNK_SIZE)) {
    await prisma.$transaction(
      chunk.map((player) => {
        const data = {
          name: player.name,
          searchKey: player.searchKey,
          birthDate: player.birthDate,
          nationality: player.nationality,
          position: player.position,
        };
        return prisma.player.upsert({
          where: { wikidataId: player.wikidataId },
          create: { wikidataId: player.wikidataId, ...data },
          update: data,
        });
      }),
    );
  }
  const playerIdByQid = new Map<string, string>();
  for (const row of await prisma.player.findMany({
    select: { id: true, wikidataId: true },
  })) {
    playerIdByQid.set(row.wikidataId, row.id);
  }

  // ─── Dönemler ─────────────────────────────────────────────────────────
  // Önce ilgili kulüplerin dönemleri silinir, sonra toplu yazılır. Tek tek
  // upsert etmek yüz binlerce satırda kabul edilemez derecede yavaş olurdu;
  // sil-ve-yaz hem hızlı hem idempotent.
  const touchedClubIds = [...new Set(input.spells.map((s) => s.clubWikidataId))]
    .map((qid) => clubIdByQid.get(qid))
    .filter((id): id is string => id !== undefined);

  for (const chunk of chunked(touchedClubIds, CHUNK_SIZE)) {
    await prisma.spell.deleteMany({ where: { clubId: { in: chunk } } });
  }

  let skippedSpells = 0;
  const rows = input.spells.flatMap((spell) => {
    const playerId = playerIdByQid.get(spell.playerWikidataId);
    const clubId = clubIdByQid.get(spell.clubWikidataId);

    // Oyuncu veya kulüp meta verisi çekilememişse dönem yazılamaz.
    // Sessizce atlamak yerine sayıp raporluyoruz (§2.7).
    if (playerId === undefined || clubId === undefined) {
      skippedSpells++;
      return [];
    }

    return [
      {
        wikidataStatementId: spell.wikidataStatementId,
        playerId,
        clubId,
        startYear: spell.startYear,
        endYear: spell.endYear,
        isCurrent: spell.isCurrent,
        isLoan: spell.isLoan,
        isYouth: spell.isYouth,
        appearances: spell.appearances,
        goals: spell.goals,
      },
    ];
  });

  let written = 0;
  for (const chunk of chunked(rows, CHUNK_SIZE)) {
    const result = await prisma.spell.createMany({ data: chunk });
    written += result.count;
  }

  // ─── Bayat kayıtları temizle ──────────────────────────────────────────
  // Upsert asla satır SİLMEZ. Bu yüzden yükleme sonunda veritabanı, gelen
  // veri kümesiyle bilinçli olarak uzlaştırılır.
  let removedClubCount = 0;

  if (input.isFullRun) {
    // Kulüp evreninden çıkmış kulüpleri sil. Dönemleri onDelete: Cascade ile
    // birlikte gider. Bu adım olmadan eski koşulardan kalan kulüpler ve
    // dönemleri veritabanında birikiyordu.
    const incoming = input.clubs.map((c) => c.wikidataId);
    const removed = await prisma.club.deleteMany({
      where: { wikidataId: { notIn: incoming } },
    });
    removedClubCount += removed.count;
  }

  // Hiç dönem kaydı olmayan kulüpler seçilemez ve gösterilemez.
  const removedEmpty = await prisma.club.deleteMany({
    where: { spells: { none: {} } },
  });
  removedClubCount += removedEmpty.count;

  // Dönemi kalmayan oyuncular: kapsam daraldığında (ör. kadın futbolcuların
  // kapsam dışına alınması) geriye kalan artıklar.
  const removedPlayers = await prisma.player.deleteMany({
    where: { spells: { none: {} } },
  });

  return {
    leagues: leagueIdByQid.size,
    clubs: await prisma.club.count(),
    players: await prisma.player.count(),
    spells: written,
    skippedSpells,
    removedStalePlayers: removedPlayers.count,
    removedEmptyClubs: removedClubCount,
  };
}

function* chunked<T>(items: readonly T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) {
    yield items.slice(i, i + size);
  }
}
