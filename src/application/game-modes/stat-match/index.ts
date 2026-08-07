import { z } from "zod";
import { isStatKey, STAT_KEYS } from "@/domain/services/stat-match";
import {
  isValidIdentifier,
  playerId,
} from "@/domain/value-objects/identifiers";
import {
  checkStatAnswer,
  getChosenStatMatch,
  getDailyStatMatch,
  type CheckStatAnswerDto,
  type DailyStatMatchDto,
  type StatMatchRoundDto,
} from "../../use-cases/daily-stat-match";
import { defineGameMode } from "../registry";
import type { RegisteredGameMode } from "../types";

/**
 * İstatistik eşleştirme modu — PROJECT.md §9.2.
 *
 * Izgarayla aynı iki tasarım kararı: tek mod birden çok eylem taşır (ayırt
 * edici birleşim) ve TARİH GİRDİDE YOKTUR — günü sunucu okur (BR-19).
 * İkincisi olmasaydı istemci yarının oyuncusunu bugünden çekebilirdi.
 *
 * `chosen` eylemi bu kuralı DELMEZ: kullanıcının seçtiği hedef bir tarih
 * değil bir kimliktir ve o kimlik BR-24'ten geçmek zorundadır. "Yarının
 * oyuncusu" hâlâ sorulamaz çünkü hangi oyuncunun hangi güne düştüğü
 * dışarıdan bilinmiyor.
 */

const statKeySchema = z
  .string()
  .refine(isStatKey, { message: "Bilinmeyen istatistik." });

const playerIdSchema = z.string().refine(isValidIdentifier).transform(playerId);

export const statMatchInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("daily") }),
  z.object({ action: z.literal("chosen"), targetId: playerIdSchema }),
  z.object({
    action: z.literal("answer"),
    statKey: statKeySchema,
    playerId: playerIdSchema,
    /** Yoksa hedef günün oyuncusudur (BR-19); varsa "Sen seç" turu (BR-24). */
    targetId: playerIdSchema.optional(),
  }),
]);

export type StatMatchInput = z.output<typeof statMatchInputSchema>;
export type StatMatchOutput =
  DailyStatMatchDto | StatMatchRoundDto | CheckStatAnswerDto;

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

    switch (input.action) {
      case "daily":
        return getDailyStatMatch(now, deps);
      case "chosen":
        return getChosenStatMatch(input.targetId, deps);
      case "answer":
        return checkStatAnswer(
          {
            now,
            statKey: input.statKey,
            playerId: input.playerId,
            targetId: input.targetId,
          },
          deps,
        );
    }
  },
});

export { STAT_KEYS };
