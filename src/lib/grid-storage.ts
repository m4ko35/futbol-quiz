import { createDailyStore, isRecord, type DailyRecord } from "./daily-storage";

/**
 * Izgara oyununun ilerlemesi — PROJECT.md §9.1.
 *
 * Mekanizma `daily-storage.ts` içinde ve iki oyun modu tarafından paylaşılır;
 * gerekçeler (neden saklanıyor, neden sunucuda değil, neden
 * `useSyncExternalStore`) orada. Burada yalnızca SAKLANAN ŞEKİL ve onun
 * doğrulaması var.
 */

export type CellState =
  | {
      readonly status: "correct";
      readonly playerId: string;
      readonly playerName: string;
    }
  | {
      readonly status: "wrong";
      readonly playerId: string;
      readonly playerName: string;
    };

export interface GameState extends DailyRecord {
  /** Hangi güne ait — gün dönünce kaydedilmiş oyun atılır (BR-11). */
  readonly date: string;
  readonly cells: Readonly<Record<string, CellState>>;
  readonly guessesUsed: number;
}

function isGameState(value: unknown): value is GameState {
  if (!isRecord(value)) return false;
  if (typeof value["date"] !== "string") return false;
  if (!Number.isInteger(value["guessesUsed"])) return false;

  const cells = value["cells"];
  if (!isRecord(cells)) return false;

  return Object.values(cells).every((cell) => {
    if (!isRecord(cell)) return false;
    return (
      (cell["status"] === "correct" || cell["status"] === "wrong") &&
      typeof cell["playerId"] === "string" &&
      typeof cell["playerName"] === "string"
    );
  });
}

const store = createDailyStore<GameState>("futbol-quiz:grid", isGameState);

export const subscribeToSavedGame = store.subscribe;
export const readSavedGame = store.read;
export const readSavedGameOnServer = store.readOnServer;
export const writeSavedGame = store.write;
export const parseSavedGame = store.parse;
export const resetSavedGameCache = store.reset;
