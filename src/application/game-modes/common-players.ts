import { z } from "zod";
import { clubId, isValidIdentifier } from "@/domain/value-objects/identifiers";
import type { CommonPlayersResultDto } from "../dto/common-players-dto";
import { findCommonPlayers } from "../use-cases/find-common-players";
import { defineGameMode } from "./registry";
import type { RegisteredGameMode } from "./types";

/**
 * MVP oyun modu: iki kulüpte de oynamış oyuncular (PROJECT.md §9).
 *
 * Bu dosya, sözleşmenin gerçekten işe yaradığının kanıtıdır: mod, çekirdek
 * koda hiç dokunmadan tanımlanıyor ve yalnızca port'lara bakıyor.
 */

/**
 * Girdi şeması — §6.2'deki sorgu parametrelerinin karşılığı.
 *
 * `clubA`/`clubB` düz dize olarak gelir ve markalı `ClubId`'ye BURADA
 * dönüşür. Sınır tam olarak burasıdır: bu noktadan sonra iç katmanlar
 * doğrulanmamış bir kimlik göremez (§2.3).
 */
export const commonPlayersInputSchema = z.object({
  clubA: z.string().refine(isValidIdentifier).transform(clubId),
  clubB: z.string().refine(isValidIdentifier).transform(clubId),
  includeYouth: z.boolean().default(false),
  includeLoans: z.boolean().default(true),
});

export type CommonPlayersInput = z.output<typeof commonPlayersInputSchema>;

export const COMMON_PLAYERS_MODE_ID = "common-players";

export const commonPlayersMode: RegisteredGameMode = defineGameMode<
  CommonPlayersInput,
  CommonPlayersResultDto
>({
  id: COMMON_PLAYERS_MODE_ID,
  title: "Ortak Oyuncu",
  inputSchema: commonPlayersInputSchema,

  execute(input, deps) {
    return findCommonPlayers(
      {
        clubA: input.clubA,
        clubB: input.clubB,
        filter: {
          includeYouth: input.includeYouth,
          includeLoans: input.includeLoans,
        },
      },
      deps,
    );
  },
});
