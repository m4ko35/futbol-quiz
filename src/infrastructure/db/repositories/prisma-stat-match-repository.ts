import { CURATED_CLUB_QIDS } from "@/application/curated-clubs";
import type {
  DailyStatPlayer,
  StatMatchRepository,
} from "@/application/ports/stat-match-repository";
import type { StatKey } from "@/domain/services/stat-match";
import { playerId, type PlayerId } from "@/domain/value-objects/identifiers";
import { Prisma, type PrismaClient } from "@/generated/prisma";

/**
 * `StatMatchRepository` port'unun Prisma uygulaması (PROJECT.md §4.1, §9.2).
 *
 * NEDEN `Prisma.sql` (§7.2'nin izin verdiği biçim). Uygunluk ölçütü tek bir
 * toplama sorgusudur: dönemleri küratörlü kulüplerle sınırla, maç ve golü
 * topla, ayrı kulüpleri say, HİÇBİR döneminde eksik değer olmasın. Prisma'nın
 * sorgu kurucusuyla bu ancak birkaç gidiş-dönüşe bölünerek ya da tüm dönemleri
 * belleğe çekerek yazılabilirdi; ikisi de bu ölçekte (193.003 dönem) yanlış
 * tercih. Şablon PARAMETRELİDİR — dize birleştirme yok, `$queryRawUnsafe` yok.
 *
 * Günün oyuncusu adayları BR-15'e göre süzülür: altı istatistik de dolu.
 */
export class PrismaStatMatchRepository implements StatMatchRepository {
  readonly #prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.#prisma = prisma;
  }

  async findDailyCandidates(): Promise<readonly DailyStatPlayer[]> {
    const rows = await this.#prisma.$queryRaw<DailyCandidateRow[]>(Prisma.sql`
      SELECT p.id            AS id,
             p.name          AS name,
             p.nationality   AS nationality,
             p.nationalCaps  AS nationalCaps,
             p.heightCm      AS heightCm,
             p.weightKg      AS weightKg,
             SUM(s.appearances)       AS appearances,
             SUM(s.goals)             AS goals,
             COUNT(DISTINCT s.clubId) AS clubs
      FROM players p
      JOIN spells s ON s.playerId = p.id AND s.isYouth = 0
      JOIN clubs  c ON c.id = s.clubId
      WHERE c.wikidataId IN (${Prisma.join(CURATED_CLUB_QIDS)})
        AND p.nationalCaps IS NOT NULL
        AND p.heightCm     IS NOT NULL
        AND p.weightKg     IS NOT NULL
      GROUP BY p.id
      HAVING SUM(CASE WHEN s.appearances IS NULL OR s.goals IS NULL THEN 1 ELSE 0 END) = 0
         AND SUM(s.appearances) >= ${MIN_APPEARANCES}
         AND COUNT(DISTINCT s.clubId) >= ${MIN_CLUBS}
      ORDER BY p.id
    `);

    return rows.map(toDailyStatPlayer);
  }

  async findStatValue(id: PlayerId, key: StatKey): Promise<number | null> {
    // Oyuncunun kendi kaydındaki alanlar — dönemlere bakmaya gerek yok.
    if (key === "nationalCaps" || key === "heightCm" || key === "weightKg") {
      const player = await this.#prisma.player.findUnique({
        where: { id },
        select: { nationalCaps: true, heightCm: true, weightKg: true },
      });
      return player?.[key] ?? null;
    }

    // KAPSAM TUTARLILIĞI: hedef küratörlü kulüplerle sınırlı sayıldığı için
    // cevap da öyle sayılmalı. Aksi hâlde kullanıcı kendi bildiği toplamla
    // puanlanır ve puan anlamını yitirir.
    const rows = await this.#prisma.$queryRaw<AggregateRow[]>(Prisma.sql`
      SELECT SUM(s.appearances)       AS appearances,
             SUM(s.goals)             AS goals,
             COUNT(DISTINCT s.clubId) AS clubs,
             SUM(CASE WHEN s.appearances IS NULL OR s.goals IS NULL THEN 1 ELSE 0 END) AS missing
      FROM spells s
      JOIN clubs c ON c.id = s.clubId
      WHERE s.playerId = ${id}
        AND s.isYouth = 0
        AND c.wikidataId IN (${Prisma.join(CURATED_CLUB_QIDS)})
    `);

    const row = rows[0];
    if (row === undefined) return null;

    const clubs = Number(row.clubs);
    // Küratörlü kulüplerde hiç oynamamış: bu istatistikte 0 DEĞİL, bilinmiyor.
    if (clubs === 0) return null;
    if (key === "clubs") return clubs;

    // Tek bir dönemde bile eksik değer varsa toplam yanıltıcıdır (§2.7).
    if (Number(row.missing) > 0) return null;

    const value = key === "appearances" ? row.appearances : row.goals;
    return value === null ? null : Number(value);
  }
}

/**
 * Aday eşikleri — ölçüldü (§9.2).
 *
 * 100 maç ve 2 kulüp, günün oyuncusunun TANINABİLİR olmasını sağlayan
 * en ucuz vekil: küratörlü kulüplerde tek maça çıkmış birini "günün oyuncusu"
 * diye sunmak, kullanıcının hiç duymadığı bir isme altı soru sordurmak olurdu.
 * Bu eşiklerle havuz 4.762 oyuncu; altı istatistik koşulundan sonra ~2.060.
 */
const MIN_APPEARANCES = 100;
const MIN_CLUBS = 2;

/**
 * SQLite `SUM`/`COUNT` sonuçlarını Prisma `bigint` olarak döndürebilir; ham
 * sorgunun tipi bu yüzden geniş tutulup dönüşüm elle yapılıyor.
 */
interface DailyCandidateRow {
  id: string;
  name: string;
  nationality: string | null;
  nationalCaps: number | bigint;
  heightCm: number | bigint;
  weightKg: number | bigint;
  appearances: number | bigint;
  goals: number | bigint;
  clubs: number | bigint;
}

interface AggregateRow {
  appearances: number | bigint | null;
  goals: number | bigint | null;
  clubs: number | bigint;
  missing: number | bigint;
}

function toDailyStatPlayer(row: DailyCandidateRow): DailyStatPlayer {
  return {
    id: playerId(row.id),
    name: row.name,
    nationality: row.nationality,
    stats: {
      appearances: Number(row.appearances),
      goals: Number(row.goals),
      clubs: Number(row.clubs),
      nationalCaps: Number(row.nationalCaps),
      heightCm: Number(row.heightCm),
      weightKg: Number(row.weightKg),
    },
  };
}
