import type {
  ClubRepository,
  ClubSearchQuery,
  CrestCredit,
  LeagueSummary,
} from "@/application/ports/club-repository";
import type { Club } from "@/domain/entities/club";
import { clubId, type ClubId } from "@/domain/value-objects/identifiers";
import { toSearchKey } from "@/domain/value-objects/search-key";
import type { PrismaClient } from "@/generated/prisma";

/**
 * `ClubRepository` port'unun Prisma uygulaması (PROJECT.md §4.1).
 *
 * Bu sınıf iş kuralı İÇERMEZ; yalnızca port sözleşmesini SQL'e çevirir ve
 * satırları domain varlıklarına eşler.
 */
export class PrismaClubRepository implements ClubRepository {
  readonly #prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.#prisma = prisma;
  }

  async search(query: ClubSearchQuery): Promise<Club[]> {
    const rows = await this.#prisma.club.findMany({
      where: {
        isSelectable: true,
        // Arama, ETL'in ürettiği aksansız `searchKey` üzerinden yapılır.
        // Doğrudan `name` üzerinde arama Türkçe'de çalışmaz: SQLite'ın
        // `LIKE`'ı ASCII dışı harflerde büyük/küçük harf duyarsızlığı
        // sunmaz, "İstanbul" araması "istanbul"u bulamazdı.
        ...(query.term === null
          ? {}
          : { searchKey: { contains: toSearchKey(query.term) } }),
        // BR-37 — lig süzgeci. İlişki üzerinden QID ile süzülür; lig
        // kimliğini önce ayrı bir sorguyla çözmek gereksiz bir gidiş-dönüş
        // olurdu. Tanınmayan QID hata değil, boş sonuç verir (port sözleşmesi).
        ...(query.leagueWikidataId === null
          ? {}
          : { league: { wikidataId: query.leagueWikidataId } }),
      },
      orderBy: { shortName: "asc" },
      take: query.limit,
    });

    return rows.map(toClub);
  }

  /**
   * §7.14 — gözatılabilir ligler.
   *
   * SAYIM SÜZGEÇLİ: `_count` doğrudan kullanılamaz, çünkü ligin bütün
   * kulüplerini sayar; kullanıcı ise yalnızca seçilebilir olanları görüyor.
   * Prisma ilişki sayımına koşul verilebildiği için ayrı sorgu gerekmiyor.
   *
   * SEÇİLEBİLİR KULÜBÜ OLMAYAN LİG DÖNMEZ: tıklandığında boş liste veren bir
   * satır, kullanıcıya veri kusuru gibi görünür.
   */
  async listLeagues(): Promise<readonly LeagueSummary[]> {
    const rows = await this.#prisma.league.findMany({
      select: {
        wikidataId: true,
        name: true,
        country: true,
        _count: { select: { clubs: { where: { isSelectable: true } } } },
      },
      orderBy: { name: "asc" },
    });

    return rows.flatMap((row) =>
      row._count.clubs === 0
        ? []
        : [
            {
              wikidataId: row.wikidataId,
              name: row.name,
              country: row.country,
              clubCount: row._count.clubs,
            },
          ],
    );
  }

  async findByIds(ids: readonly ClubId[]): Promise<Club[]> {
    if (ids.length === 0) return [];

    const rows = await this.#prisma.club.findMany({
      where: { id: { in: [...ids] } },
    });

    return rows.map(toClub);
  }

  /** §9.1 — ızgara havuzunu QID'den çözer. */
  async findByWikidataIds(wikidataIds: readonly string[]): Promise<Club[]> {
    if (wikidataIds.length === 0) return [];

    const rows = await this.#prisma.club.findMany({
      where: { wikidataId: { in: [...wikidataIds] }, isSelectable: true },
    });

    return rows.map(toClub);
  }

  /**
   * §7.3, BR-34 — arma atıf künyeleri.
   *
   * ÜÇ ALANIN DA DOLU OLMASI ŞART. Eksik künyeli bir arma zaten
   * gösterilmemeli; onu atıf listesinde de göstermek, eksikliği görünmez
   * kılmak olurdu. `db:verify` aynı koşulu veri tarafında ölçer.
   */
  async listCrestCredits(): Promise<readonly CrestCredit[]> {
    const rows = await this.#prisma.club.findMany({
      where: {
        crestUrl: { not: null },
        crestLicense: { not: null },
        crestFilePage: { not: null },
      },
      select: {
        shortName: true,
        crestLicense: true,
        crestAuthor: true,
        crestFilePage: true,
      },
      orderBy: { shortName: "asc" },
    });

    return rows.flatMap((row) =>
      row.crestLicense === null || row.crestFilePage === null
        ? []
        : [
            {
              clubName: row.shortName,
              license: row.crestLicense,
              author: row.crestAuthor,
              filePage: row.crestFilePage,
            },
          ],
    );
  }
}

/** Prisma satırı → domain varlığı. */
function toClub(row: {
  id: string;
  name: string;
  shortName: string;
  country: string | null;
  foundedYear: number | null;
  crestUrl: string | null;
  isSelectable: boolean;
  playerCount: number;
}): Club {
  return {
    id: clubId(row.id),
    name: row.name,
    shortName: row.shortName,
    country: row.country,
    foundedYear: row.foundedYear,
    crestUrl: row.crestUrl,
    isSelectable: row.isSelectable,
    playerCount: row.playerCount,
  };
}
