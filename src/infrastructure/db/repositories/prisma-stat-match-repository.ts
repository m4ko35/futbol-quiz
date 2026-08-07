import { CURATED_CLUB_QIDS } from "@/application/curated-clubs";
import type {
  StatMatchRepository,
  StatMatchTarget,
} from "@/application/ports/stat-match-repository";
import type { StatKey } from "@/domain/services/stat-match";
import { playerId, type PlayerId } from "@/domain/value-objects/identifiers";
import { Prisma, type PrismaClient } from "@/generated/prisma";

/**
 * `StatMatchRepository` port'unun Prisma uygulaması (PROJECT.md §4.1, §9.2).
 *
 * NEDEN `Prisma.sql` (§7.2'nin izin verdiği biçim). Uygunluk ölçütü tek bir
 * toplama sorgusudur: maç ve golü topla, ayrı kulüpleri say, HİÇBİR döneminde
 * eksik değer olmasın. Prisma'nın sorgu kurucusuyla bu ancak birkaç
 * gidiş-dönüşe bölünerek ya da tüm dönemleri belleğe çekerek yazılabilirdi;
 * ikisi de bu ölçekte (405.418 dönem) yanlış tercih. Şablon PARAMETRELİDİR —
 * dize birleştirme yok, `$queryRawUnsafe` yok.
 *
 * BR-23 — İKİ KAPSAM AYRIDIR ve bu dosyanın ana yapısı odur:
 *
 *   · TANINIRLIK  → küratörlü kulüpler (§9.1). Yalnızca "bu oyuncu günün
 *                   oyuncusu OLABİLİR Mİ" sorusunu yanıtlar.
 *   · DEĞERLER    → §1.3 kapsamındaki TÜM kulüpler. Kullanıcıya gösterilen
 *                   ve puanlanan sayılar bunlardır.
 *
 * Eskiden ikisi tek `WHERE` idi ve kapsam bildirimi üç lig turu boyunca
 * yanlış kaldı (Cantona 235 gösteriliyordu, gerçek 408). Ayrım burada
 * yapıldığı için iki sorgu da kendi işini anlatıyor.
 */
export class PrismaStatMatchRepository implements StatMatchRepository {
  readonly #prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.#prisma = prisma;
  }

  async findDailyCandidates(): Promise<readonly StatMatchTarget[]> {
    const rows = await this.#prisma.$queryRaw<TargetRow[]>(Prisma.sql`
      WITH taninir AS (
        SELECT s.playerId AS pid
        FROM spells s
        JOIN clubs c ON c.id = s.clubId
        WHERE s.isYouth = 0
          AND c.wikidataId IN (${Prisma.join(CURATED_CLUB_QIDS)})
        GROUP BY s.playerId
        HAVING SUM(s.appearances) >= ${MIN_APPEARANCES}
           AND COUNT(DISTINCT s.clubId) >= ${MIN_CLUBS}
      )
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
      JOIN taninir t ON t.pid = p.id
      JOIN spells  s ON s.playerId = p.id AND s.isYouth = 0
      WHERE p.nationalCaps IS NOT NULL
        AND p.heightCm     IS NOT NULL
        AND p.weightKg     IS NOT NULL
      GROUP BY p.id
      HAVING SUM(CASE WHEN s.appearances IS NULL OR s.goals IS NULL THEN 1 ELSE 0 END) = 0
      ORDER BY p.id
    `);

    return rows.map(toTarget);
  }

  async findChosenTarget(id: PlayerId): Promise<StatMatchTarget | null> {
    // Tanınırlık süzgeci YOK (§9.2): seçen kullanıcı kimi seçtiğini biliyor.
    // Kalan tek eşik puanın anlamlı olması için: tek maçlık bir kariyerin
    // "kulüp golü" hedefi diye sunulması oyunu bozardı.
    //
    // "2+ kulüp" ŞARTI BİLEREK YOK. Günün oyuncusunda o şart tanınırlık
    // içindi. Burada taşınsaydı, seçicinin süzgeci (`targetableWhere`) bunu
    // Prisma'nın `where` diliyle ifade edemez ve ölçüt ile süzgeç ayrışırdı —
    // seçici gösterir, sunucu reddederdi. Ölçülen bedel: 5.242 yerine 5.524.
    const rows = await this.#prisma.$queryRaw<TargetRow[]>(Prisma.sql`
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
      WHERE p.id = ${id}
        AND p.nationalCaps IS NOT NULL
        AND p.heightCm     IS NOT NULL
        AND p.weightKg     IS NOT NULL
      GROUP BY p.id
      HAVING SUM(CASE WHEN s.appearances IS NULL OR s.goals IS NULL THEN 1 ELSE 0 END) = 0
         AND SUM(s.appearances) >= ${MIN_APPEARANCES}
    `);

    const row = rows[0];
    return row === undefined ? null : toTarget(row);
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

    // BR-23 — hedef 24 ligi saydığı için cevap da sayar. Küratörlü kısıt
    // BURADA DA yoktu değil: vardı ve kaldırıldı; iki taraf farklı ölçekte
    // karşılaştırıldığında puan anlamını yitiriyordu.
    const rows = await this.#prisma.$queryRaw<AggregateRow[]>(Prisma.sql`
      SELECT SUM(s.appearances)       AS appearances,
             SUM(s.goals)             AS goals,
             COUNT(DISTINCT s.clubId) AS clubs,
             SUM(CASE WHEN s.appearances IS NULL OR s.goals IS NULL THEN 1 ELSE 0 END) AS missing
      FROM spells s
      WHERE s.playerId = ${id}
        AND s.isYouth = 0
    `);

    const row = rows[0];
    if (row === undefined) return null;

    const clubs = Number(row.clubs);
    // Kapsamda hiç dönemi yok: bu istatistikte 0 DEĞİL, bilinmiyor.
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
 *
 * "Sen seç" turunda YALNIZCA `MIN_APPEARANCES` geçerlidir ve tüm kapsama
 * uygulanır: amaç tanınırlık değil, puanın anlamlı olması. `MIN_CLUBS` orada
 * kasten yok — gerekçesi `findChosenTarget` içinde.
 *
 * Ölçülen havuzlar: günün oyuncusu 1.927 · "Sen seç" 5.524.
 */
const MIN_APPEARANCES = 100;
const MIN_CLUBS = 2;

/**
 * SQLite `SUM`/`COUNT` sonuçlarını Prisma `bigint` olarak döndürebilir; ham
 * sorgunun tipi bu yüzden geniş tutulup dönüşüm elle yapılıyor.
 */
interface TargetRow {
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

function toTarget(row: TargetRow): StatMatchTarget {
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
