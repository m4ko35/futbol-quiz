import { CURATED_CLUB_QIDS } from "@/application/curated-clubs";
import type {
  StatMatchRepository,
  StatMatchTarget,
} from "@/application/ports/stat-match-repository";
import { officialTotal, type StatKey } from "@/domain/services/stat-match";
import { playerId, type PlayerId } from "@/domain/value-objects/identifiers";
import { Prisma, type PrismaClient } from "@/generated/prisma";
import { yearOf } from "../birth-year";

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
 *                   oyuncusu OLABİLİR Mİ" sorusunu yanıtlar; dönemlerden
 *                   toplanır, çünkü sorduğu şey BİZİM kapsamımızdır.
 *   · DEĞERLER    → kullanıcıya gösterilen ve puanlanan sayılar. Maç ve gol
 *                   artık oyuncu kaydından gelir: kulüp kariyerinin tamamı
 *                   artı A millî takım (`officialTotal`). Kulüp SAYISI
 *                   dönemlerden gelmeye devam eder — Vikipedi'nin kariyer
 *                   toplamı o soruyu taşımıyor.
 *
 * Eskiden ikisi tek `WHERE` idi ve kapsam bildirimi üç lig turu boyunca
 * yanlış kaldı (Cantona 235 gösteriliyordu, gerçek 408). Ayrım burada
 * yapıldığı için iki sorgu da kendi işini anlatıyor.
 *
 * MAÇ VE GOL BİRLİKTE GEÇTİ, tek başına değil (§9.2). İkisi de Vikipedi'nin
 * kariyer toplamı satırından, AYNI hücrelerden okunuyor; ölçüldü, tanınırlık
 * havuzunda ikisinin kapsamı birebir aynı (2.789/2.789, ayrışan 0). Yalnız
 * gol geçseydi ekranda "527 gol / 427 maç" gibi 39 imkânsız kart çıkardı —
 * Kane, Suárez, Tévez, Álvarez dâhil.
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
             p.birthDate     AS birthDate,
             p.clubCareerAppearances AS clubAppearances,
             p.clubCareerGoals       AS clubGoals,
             p.nationalGoals         AS nationalGoals,
             COUNT(DISTINCT s.clubId) AS clubs
      FROM players p
      JOIN taninir t ON t.pid = p.id
      JOIN spells  s ON s.playerId = p.id AND s.isYouth = 0
      WHERE p.nationalCaps          IS NOT NULL
        AND p.nationalGoals         IS NOT NULL
        AND p.clubCareerAppearances IS NOT NULL
        AND p.clubCareerGoals       IS NOT NULL
        AND p.heightCm              IS NOT NULL
        AND p.birthDate             IS NOT NULL
      GROUP BY p.id
      ORDER BY p.id
    `);

    return rows.map(toTarget);
  }

  async findChosenTarget(id: PlayerId): Promise<StatMatchTarget | null> {
    // Tanınırlık süzgeci YOK (§9.2): seçen kullanıcı kimi seçtiğini biliyor.
    // Kalan tek eşik puanın anlamlı olması için: tek maçlık bir kariyerin
    // "resmî gol" hedefi diye sunulması oyunu bozardı.
    //
    // EŞİK KAPSAMDAKİ MAÇI SAYAR (`careerAppearances`), gösterilen kariyer
    // toplamını DEĞİL. İkisi farklı sorular soruyor: gösterilen sayı "bu
    // oyuncu ne yaptı", eşik ise "bizim verimiz bu oyuncuyu ne kadar
    // tanıyor". `SUM(s.appearances)` yerine denormalize sütun okunuyor
    // çünkü seçicinin süzgeci (`targetableWhere`) Prisma'nın `where` diliyle
    // ancak böyle ifade edilebilir — ikisi ayrışırsa seçici gösterir,
    // sunucu reddeder.
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
             p.birthDate     AS birthDate,
             p.clubCareerAppearances AS clubAppearances,
             p.clubCareerGoals       AS clubGoals,
             p.nationalGoals         AS nationalGoals,
             COUNT(DISTINCT s.clubId) AS clubs
      FROM players p
      JOIN spells s ON s.playerId = p.id AND s.isYouth = 0
      WHERE p.id = ${id}
        AND p.nationalCaps          IS NOT NULL
        AND p.nationalGoals         IS NOT NULL
        AND p.clubCareerAppearances IS NOT NULL
        AND p.clubCareerGoals       IS NOT NULL
        AND p.heightCm              IS NOT NULL
        AND p.birthDate             IS NOT NULL
        AND p.careerAppearances >= ${MIN_APPEARANCES}
      GROUP BY p.id
    `);

    const row = rows[0];
    return row === undefined ? null : toTarget(row);
  }

  async findStatValue(id: PlayerId, key: StatKey): Promise<number | null> {
    // Oyuncunun kendi kaydındaki alanlar — dönemlere bakmaya gerek yok.
    if (key === "nationalCaps" || key === "heightCm" || key === "birthYear") {
      const player = await this.#prisma.player.findUnique({
        where: { id },
        select: { nationalCaps: true, heightCm: true, birthDate: true },
      });
      if (player === null) return null;
      if (key === "birthYear") return yearOf(player.birthDate);
      return player[key];
    }

    // BR-23 — hedef resmî toplamı gösteriyorsa cevap da onu sayar. İki taraf
    // farklı ölçekte karşılaştırıldığında puan anlamını yitirir; bu kural bir
    // kez ölçülmüş bir kusurdur, tercih değil.
    if (key === "appearances" || key === "goals") {
      const player = await this.#prisma.player.findUnique({
        where: { id },
        select: {
          clubCareerAppearances: true,
          clubCareerGoals: true,
          nationalCaps: true,
          nationalGoals: true,
        },
      });
      if (player === null) return null;

      return key === "appearances"
        ? officialTotal(player.clubCareerAppearances, player.nationalCaps)
        : officialTotal(player.clubCareerGoals, player.nationalGoals);
    }

    // Kulüp SAYISI kapsama bağlı kalır (§9.2): kariyer toplamı satırı "kaç
    // kulüpte oynadı" sorusunu taşımıyor, dolayısıyla tek kaynağı dönemler.
    const rows = await this.#prisma.$queryRaw<AggregateRow[]>(Prisma.sql`
      SELECT COUNT(DISTINCT s.clubId) AS clubs
      FROM spells s
      WHERE s.playerId = ${id}
        AND s.isYouth = 0
    `);

    const row = rows[0];
    if (row === undefined) return null;

    const clubs = Number(row.clubs);
    // Kapsamda hiç dönemi yok: bu istatistikte 0 DEĞİL, bilinmiyor.
    return clubs === 0 ? null : clubs;
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
 * ÖLÇÜLEN HAVUZLAR (22 Ağustos 2026, BR-23 geçişinden SONRA):
 * günün oyuncusu **1.766** (önce 2.662) · "Sen seç" **4.392** (önce 9.325).
 * Daralmanın sebebi eşikler değil, resmî toplamın kapsamı: kariyer toplamı
 * okunamamış oyuncu için gösterilecek bir sayı yok (§9.2).
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
  birthDate: Date;
  clubAppearances: number | bigint;
  clubGoals: number | bigint;
  nationalGoals: number | bigint;
  clubs: number | bigint;
}

interface AggregateRow {
  clubs: number | bigint;
}

function toTarget(row: TargetRow): StatMatchTarget {
  return {
    id: playerId(row.id),
    name: row.name,
    nationality: row.nationality,
    stats: {
      // Sorgu dört parçayı da `IS NOT NULL` süzdüğü için toplamlar burada
      // null olamaz; `?? 0` yerine `Number` yeter ve yedek değer uydurmaz.
      appearances: Number(row.clubAppearances) + Number(row.nationalCaps),
      goals: Number(row.clubGoals) + Number(row.nationalGoals),
      clubs: Number(row.clubs),
      nationalCaps: Number(row.nationalCaps),
      heightCm: Number(row.heightCm),
      // `TargetRow.birthDate` null DEĞİL: havuz sorgusu `IS NOT NULL` süzüyor.
      // `yearOf` bunu aşırı yükle ile biliyor, yani burada yedek değer yok.
      birthYear: yearOf(row.birthDate),
    },
  };
}
