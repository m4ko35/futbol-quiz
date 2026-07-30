import { toPlayerDto, type PlayerDto } from "../dto/player-dto";
import type { PlayerRepository } from "../ports/player-repository";

/**
 * Oyuncu arama — ızgarada cevap seçmek için (PROJECT.md §6.4, BR-12).
 */

/** §7.1 — istemcinin verdiği `limit` değerine güvenilmez, kelepçelenir. */
export const MAX_PLAYER_RESULTS = 20;
export const DEFAULT_PLAYER_RESULTS = 10;

/** §7.1 — kaynak tüketimini sınırlamak için arama metni üst sınırı. */
export const MAX_PLAYER_TERM_LENGTH = 50;

/**
 * Aramanın başlaması için gereken en az karakter.
 *
 * Kulüp aramasında böyle bir alt sınır YOK ve olmaması doğru: 345 kulübün
 * tamamı listelenebilir bir sayı. Oyuncu tarafında 76.358 kayıt var; tek
 * harflik bir arama on binlerce satır tarar ve sonuç kullanıcıya da yaramaz.
 * İki karakter, hem sorguyu anlamlı kılar hem de §7.1'in kaynak tüketimi
 * sınırını korur.
 */
export const MIN_PLAYER_TERM_LENGTH = 2;

export interface SearchPlayersInput {
  readonly term: string;
  readonly limit?: number;
}

export interface SearchPlayersDeps {
  readonly players: PlayerRepository;
}

export async function searchPlayers(
  input: SearchPlayersInput,
  deps: SearchPlayersDeps,
): Promise<PlayerDto[]> {
  const term = input.term.trim().slice(0, MAX_PLAYER_TERM_LENGTH);

  // Kısa metin BOŞ LİSTE döner, hata değil. Kullanıcı yazmaya başlarken her
  // tuşta hata görmemeli; bu bir kural ihlali değil, henüz tamamlanmamış bir
  // girdi.
  if (term.length < MIN_PLAYER_TERM_LENGTH) return [];

  const players = await deps.players.search({
    term,
    limit: clampLimit(input.limit),
  });

  return players.map(toPlayerDto);
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_PLAYER_RESULTS;
  }

  const asInteger = Math.trunc(limit);
  if (asInteger < 1) return 1;
  return Math.min(asInteger, MAX_PLAYER_RESULTS);
}
