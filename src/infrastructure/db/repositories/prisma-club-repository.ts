import type {
  ClubRepository,
  ClubSearchQuery,
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
      },
      orderBy: { shortName: "asc" },
      take: query.limit,
    });

    return rows.map(toClub);
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
}): Club {
  return {
    id: clubId(row.id),
    name: row.name,
    shortName: row.shortName,
    country: row.country,
    foundedYear: row.foundedYear,
    crestUrl: row.crestUrl,
    isSelectable: row.isSelectable,
  };
}
