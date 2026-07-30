import { toClubDto, type ClubDto } from "../dto/club-dto";
import type { ClubRepository } from "../ports/club-repository";

/**
 * Kulüp arama / otomatik tamamlama — PROJECT.md §6.1.
 */

/** §7.1 — istemcinin verdiği `limit` değerine güvenilmez, kelepçelenir. */
export const MAX_CLUB_RESULTS = 50;
export const DEFAULT_CLUB_RESULTS = 20;

/** §7.1 — kaynak tüketimini sınırlamak için arama metni üst sınırı. */
export const MAX_SEARCH_TERM_LENGTH = 50;

export interface SearchClubsInput {
  readonly term?: string;
  readonly limit?: number;
}

export interface SearchClubsDeps {
  readonly clubs: ClubRepository;
}

export async function searchClubs(
  input: SearchClubsInput,
  deps: SearchClubsDeps,
): Promise<ClubDto[]> {
  const clubs = await deps.clubs.search({
    term: normalizeTerm(input.term),
    limit: clampLimit(input.limit),
  });

  return clubs.map(toClubDto);
}

/**
 * Boş ve yalnızca boşluktan oluşan metin `null`'a indirgenir.
 *
 * Ayrım önemli: `null` "arama yok, listeyi göster" demektir; boş dize ise
 * "her şeyle eşleşen bir arama" gibi davranıp aynı sonucu tesadüfen verirdi.
 * Tesadüfen doğru olan davranış, ilk değişiklikte bozulur.
 */
function normalizeTerm(term: string | undefined): string | null {
  if (term === undefined) return null;

  const trimmed = term.trim().slice(0, MAX_SEARCH_TERM_LENGTH);
  return trimmed.length === 0 ? null : trimmed;
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_CLUB_RESULTS;
  }

  const asInteger = Math.trunc(limit);
  if (asInteger < 1) return 1;
  return Math.min(asInteger, MAX_CLUB_RESULTS);
}
