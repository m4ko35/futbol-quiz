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
     * §9.2 — kulüp kariyerinin tamamı, oyuncu QID başına.
     *
     * Çapraz denetimi geçmiş kayıtlardır (`career-total-check.ts`). Verilmezse
     * ya da bir oyuncu haritada yoksa sütun `null` yazılır — atlanmaz. Alanı
     * atlamak, kaynağından DÜŞMÜŞ bir değeri veritabanında sessizce ayakta
     * bırakırdı; `nationalCaps` için aynı gerekçe aşağıda yazılı.
     */
    readonly careerTotals?: ReadonlyMap<
      string,
      { readonly appearances: number | null; readonly goals: number | null }
    >;
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
  //
  // Dejenerelik paydası (BR-36) burada, YAZMADAN ÖNCE hesaplanır — arama
  // ağırlığıyla (BR-21) aynı gerekçe: girdi zaten bellekte, dönemler henüz
  // veritabanında değil ve tek tarama yetiyor.
  //
  // KAYIT DEĞİL KİŞİ SAYILIR: aynı oyuncu aynı kulüpte birden çok dönem
  // geçirmiş olabilir (kiralık dönüşü, yıllar sonra geri dönüş) ve BR-36
  // "kadronun ne kadarı" diye sorduğu için tekilleştirme şart.
  const playersByClub = new Map<string, Set<string>>();
  for (const spell of input.spells) {
    if (spell.isYouth) continue;
    let players = playersByClub.get(spell.clubWikidataId);
    if (players === undefined) {
      players = new Set<string>();
      playersByClub.set(spell.clubWikidataId, players);
    }
    players.add(spell.playerWikidataId);
  }

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
          playerCount: playersByClub.get(club.wikidataId)?.size ?? 0,
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
  //
  // Arama sıralama ağırlığı (BR-21) burada, YAZMADAN ÖNCE hesaplanır. Dönemler
  // henüz veritabanında olmadığı için sonradan bir SQL toplaması yapmak ikinci
  // bir geçiş demek olurdu; girdi zaten bellekte ve tek tarama yetiyor.
  //
  // Altyapı dönemleri sayılmaz (BR-2): amaç "bu adı arayan kullanıcı hangi
  // oyuncuyu kastediyor" sorusunu yanıtlamak ve altyapı kayıtları bu konuda
  // sinyal taşımıyor.
  const appearancesByPlayer = new Map<string, number>();
  for (const spell of input.spells) {
    if (spell.isYouth || spell.appearances === null) continue;
    appearancesByPlayer.set(
      spell.playerWikidataId,
      (appearancesByPlayer.get(spell.playerWikidataId) ?? 0) +
        spell.appearances,
    );
  }

  for (const chunk of chunked(input.players, CHUNK_SIZE)) {
    await prisma.$transaction(
      chunk.map((player) => {
        const data = {
          name: player.name,
          searchKey: player.searchKey,
          birthDate: player.birthDate,
          nationality: player.nationality,
          position: player.position,
          // §9.2 — eksik olması normaldir; `null` yazmak doğru davranış,
          // alanı atlamak eski bir değeri sessizce ayakta bırakırdı.
          nationalCaps: player.nationalCaps,
          nationalGoals: player.nationalGoals,
          clubCareerAppearances:
            input.careerTotals?.get(player.wikidataId)?.appearances ?? null,
          clubCareerGoals:
            input.careerTotals?.get(player.wikidataId)?.goals ?? null,
          heightCm: player.heightCm,
          weightKg: player.weightKg,
          careerAppearances: appearancesByPlayer.get(player.wikidataId) ?? 0,
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
  const incomingClubIds = input.clubs
    .map((club) => clubIdByQid.get(club.wikidataId))
    .filter((id): id is string => id !== undefined);

  /**
   * EVRENDEN ÇIKMIŞ KULÜPLERİN DÖNEMLERİ ÖNCE SİLİNİR.
   *
   * BİR DÖNEM KULÜP DEĞİŞTİREBİLİR ve yükleyici bunu varsaymıyordu. §5.3'ün
   * kulüp ikizi birleştirmesi gölge kulübün dönemlerini asıl kulübe taşıyor;
   * ifade kimliği (doğal anahtar) aynı kalıyor, kulübü değişiyor. Eski satır
   * veritabanında hâlâ GÖLGE kulüpte duruyordu ve gölge artık "dokunulan
   * kulüpler" listesinde olmadığı için silinmiyordu — yazma
   * `wikidataStatementId` benzersizlik kısıtına takılıyordu.
   *
   * Bayat kulüp temizliği bunu çözerdi ama yazmadan SONRA çalışıyor. Kulüp
   * evreni her koşuda eksiksiz geldiği için (`--max-clubs` yalnızca DÖNEM
   * çekimini sınırlar) bu silme kısmi koşuda da güvenlidir.
   */
  await prisma.spell.deleteMany({
    where: { clubId: { notIn: incomingClubIds } },
  });

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

  // ─── Künye ────────────────────────────────────────────────────────────
  // EN SONA yazılır ve bilerek: tarih, "ETL başladı" değil "veri kümesi hazır
  // oldu" anlamına gelmelidir. Yükleme yarıda kalırsa künye de güncellenmez ve
  // kullanıcıya eski (doğru) tarih gösterilmeye devam eder.
  //
  // Kısmi koşularda (`--max-clubs`) YAZILMAZ: 3 kulüplük bir deneme koşusunun
  // tarihi, tam veri kümesinin tazeliği hakkında yanlış bilgi verirdi.
  if (input.isFullRun) {
    const generatedAt = new Date();
    await prisma.datasetMeta.upsert({
      where: { id: 1 },
      create: { id: 1, generatedAt },
      update: { generatedAt },
    });
  }

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
