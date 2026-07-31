import { z } from "zod";
import { isStatKey, STAT_KEYS } from "@/domain/services/stat-match";
import {
  isValidIdentifier,
  playerId,
} from "@/domain/value-objects/identifiers";
import {
  checkStatAnswer,
  getDailyStatMatch,
  type CheckStatAnswerDto,
  type DailyStatMatchDto,
} from "../../use-cases/daily-stat-match";
import { defineGameMode } from "../registry";
import type { RegisteredGameMode } from "../types";

/**
 * İstatistik eşleştirme modu — PROJECT.md §9.2.
 *
 * Izgarayla aynı iki tasarım kararı: tek mod iki eylem taşır (ayırt edici
 * birleşim) ve tarih girdide YOKTUR — günü sunucu okur (BR-19). İkincisi
 * olmasaydı istemci yarının oyuncusunu bugünden çekebilirdi.
 */

const statKeySchema = z
  .string()
  .refine(isStatKey, { message: "Bilinmeyen istatistik." });

export const statMatchInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("daily") }),
  z.object({
    action: z.literal("answer"),
    statKey: statKeySchema,
    playerId: z.string().refine(isValidIdentifier).transform(playerId),
  }),
]);

export type StatMatchInput = z.output<typeof statMatchInputSchema>;
export type StatMatchOutput = DailyStatMatchDto | CheckStatAnswerDto;

export const STAT_MATCH_MODE_ID = "stat-match";

export const statMatchMode: RegisteredGameMode = defineGameMode<
  StatMatchInput,
  StatMatchOutput
>({
  id: STAT_MATCH_MODE_ID,
  title: "İstatistik Eşleştirme",
  inputSchema: statMatchInputSchema,

  execute(input, deps) {
    const now = new Date();

    return input.action === "daily"
      ? getDailyStatMatch(now, deps)
      : checkStatAnswer(
          { now, statKey: input.statKey, playerId: input.playerId },
          deps,
        );
  },
});

export { STAT_KEYS };
