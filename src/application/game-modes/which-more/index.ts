import { z } from "zod";
import { isStatKey, STAT_KEYS } from "@/domain/services/stat-match";
import { isDirection } from "@/domain/services/which-more";
import {
  isValidIdentifier,
  playerId,
} from "@/domain/value-objects/identifiers";
import {
  checkAnswer,
  getRound,
  type WhichMoreAnswerDto,
  type WhichMoreRoundDto,
} from "../../use-cases/which-more";
import { defineGameMode } from "../registry";
import type { RegisteredGameMode } from "../types";

/**
 * "Hangisi daha" modu — PROJECT.md §9.3.
 *
 * Izgara ve istatistik modlarıyla aynı kalıp: tek mod, ayırt edici birleşimle
 * iki eylem taşır. Buradaki ayırt edici kural BR-32'dir — `round` eylemi sayı
 * DÖNDÜRMEZ, `answer` eylemi döndürür.
 *
 * `direction` yalnızca `answer` girdisindedir. Tur kurulurken yön bilinmesi
 * GEREKMEZ: band ve dengeleme yönden bağımsız çalışır (§9.3). Tur ucuna da
 * konsaydı iki uç arasında tutarlılığı hiçbir şey zorlamazdı.
 */

const statKeySchema = z
  .string()
  .refine(isStatKey, { message: "Bilinmeyen istatistik." });

const directionSchema = z
  .string()
  .refine(isDirection, { message: "Bilinmeyen yön." });

const playerIdSchema = z.string().refine(isValidIdentifier).transform(playerId);

/**
 * Dışlama listesinin tavanı — BR-28.
 *
 * Liste koşu boyunca büyüyor ve sınırsız bırakılırsa istemci istediği kadar
 * uzun bir dizi gönderip her turda o kadar kimliği sorguya sokabilir. Tavan bir
 * oyun kısıtı değil, bir KAYNAK kısıtıdır (§7.1): 200 kimlik, ölçülen en uzun
 * makul koşunun (p99 ≈ 6) çok üstünde.
 */
export const MAX_EXCLUDED = 200;

export const whichMoreInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("round"),
    statKey: statKeySchema,
    /** Yoksa koşunun ilk turu kurulur. */
    stayingId: playerIdSchema.optional(),
    exclude: z.array(playerIdSchema).max(MAX_EXCLUDED).optional(),
  }),
  z.object({
    action: z.literal("answer"),
    statKey: statKeySchema,
    direction: directionSchema,
    leftId: playerIdSchema,
    rightId: playerIdSchema,
    chosenId: playerIdSchema,
  }),
]);

export type WhichMoreInput = z.output<typeof whichMoreInputSchema>;
export type WhichMoreOutput = WhichMoreRoundDto | WhichMoreAnswerDto;

export const WHICH_MORE_MODE_ID = "which-more";

export const whichMoreMode: RegisteredGameMode = defineGameMode<
  WhichMoreInput,
  WhichMoreOutput
>({
  id: WHICH_MORE_MODE_ID,
  title: "Hangisi Daha",
  inputSchema: whichMoreInputSchema,

  execute(input, deps) {
    switch (input.action) {
      case "round":
        return getRound(
          {
            statKey: input.statKey,
            stayingId: input.stayingId ?? null,
            exclude: input.exclude ?? [],
          },
          deps,
        );
      case "answer":
        return checkAnswer(input, deps);
    }
  },
});

export { STAT_KEYS };
