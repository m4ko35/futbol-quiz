import {
  buildLeaderboard,
  periodRange,
  rankOf,
  type LeaderboardPeriod,
  type RankedEntry,
} from "@/domain/services/leaderboard";
import type { AccountsRepository } from "../ports/accounts-repository";

/**
 * Lider tablosu — PROJECT.md §11.5, BR-50.
 *
 * SORGU DAR, HESAP SAF: depo yalnızca tamamlanmış turları getirir (BR-45),
 * toplama ve sıralama `domain/services/leaderboard.ts` içindedir. Sıralamayı
 * SQL'e taşımak cazipti ama eşitlik kuralı (aynı sıra, farklı gösterim) ve
 * "ulaşma anı son turunkidir" kararı orada okunaksız hâle gelirdi.
 */

export interface LeaderboardRowDto {
  readonly rank: number;
  readonly displayName: string;
  readonly points: number;
  readonly days: number;
  /** Bu satır isteği yapan kullanıcıya mı ait? */
  readonly isMe: boolean;
}

export interface LeaderboardDto {
  readonly period: LeaderboardPeriod;
  readonly rows: readonly LeaderboardRowDto[];
  /**
   * Kullanıcının kendi satırı — tabloda GÖRÜNMÜYORSA doludur.
   *
   * Uzun bir listede kendini aramak zorunda kalmak, tablonun teşvik olma
   * amacını baltalar: sırasını göremeyen kullanıcı için tablo bir duvardır.
   */
  readonly me: LeaderboardRowDto | null;
}

export interface LeaderboardDeps {
  readonly accounts: AccountsRepository;
}

/**
 * Gösterilen satır sayısı.
 *
 * SINIR VAR çünkü liste büyüdükçe yanıt da büyür ve ilk 50'den sonrası
 * kimsenin okumadığı bir kuyruğa dönüşür. Kullanıcı kendi sırasını `me`
 * alanından görüyor, yani sınır onu listeden DÜŞÜRMÜYOR.
 */
export const LEADERBOARD_LIMIT = 50;

function toRow(entry: RankedEntry, userId: string | null): LeaderboardRowDto {
  return {
    rank: entry.rank,
    displayName: entry.displayName,
    points: entry.points,
    days: entry.days,
    isMe: userId !== null && entry.userId === userId,
  };
}

export async function getLeaderboard(
  period: LeaderboardPeriod,
  now: Date,
  userId: string | null,
  deps: LeaderboardDeps,
): Promise<LeaderboardDto> {
  const rounds = await deps.accounts.findCompletedRounds(
    periodRange(period, now),
  );

  const ranked = buildLeaderboard(rounds);
  const rows = ranked.slice(0, LEADERBOARD_LIMIT).map((e) => toRow(e, userId));

  const mine = userId === null ? null : rankOf(ranked, userId);
  const visible = rows.some((row) => row.isMe);

  return {
    period,
    rows,
    me: mine === null || visible ? null : toRow(mine, userId),
  };
}
