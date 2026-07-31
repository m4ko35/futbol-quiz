import { isStatKey, type StatKey } from "@/domain/services/stat-match";
import { createDailyStore, isRecord, type DailyRecord } from "./daily-storage";

/**
 * İstatistik eşleştirme ilerlemesi — PROJECT.md §9.2.
 *
 * Mekanizma ve gerekçeleri `daily-storage.ts` içinde; burada yalnızca saklanan
 * şekil ve doğrulaması var.
 */

export interface StatAnswer {
  readonly playerId: string;
  readonly playerName: string;
  /** Seçilen oyuncunun o istatistikteki değeri — sunucudan gelir. */
  readonly value: number;
  /** BR-18, 0–100. */
  readonly score: number;
}

export interface StatMatchState extends DailyRecord {
  readonly date: string;
  readonly answers: Readonly<Partial<Record<StatKey, StatAnswer>>>;
}

function isStatAnswer(value: unknown): value is StatAnswer {
  if (!isRecord(value)) return false;
  return (
    typeof value["playerId"] === "string" &&
    typeof value["playerName"] === "string" &&
    typeof value["value"] === "number" &&
    typeof value["score"] === "number"
  );
}

function isStatMatchState(value: unknown): value is StatMatchState {
  if (!isRecord(value)) return false;
  if (typeof value["date"] !== "string") return false;

  const answers = value["answers"];
  if (!isRecord(answers)) return false;

  // Anahtar da doğrulanır: depoya elle yazılmış tanınmayan bir istatistik
  // adı, ekranda sessizce görünmez bir cevap olurdu.
  return Object.entries(answers).every(
    ([key, answer]) => isStatKey(key) && isStatAnswer(answer),
  );
}

const store = createDailyStore<StatMatchState>(
  "futbol-quiz:stat-match",
  isStatMatchState,
);

export const subscribeToStatMatch = store.subscribe;
export const readStatMatch = store.read;
export const readStatMatchOnServer = store.readOnServer;
export const writeStatMatch = store.write;
export const parseStatMatch = store.parse;
export const resetStatMatchCache = store.reset;
