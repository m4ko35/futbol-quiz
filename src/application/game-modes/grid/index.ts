import { z } from "zod";
import { GRID_SIZE } from "@/domain/services/grid";
import {
  isValidIdentifier,
  playerId,
} from "@/domain/value-objects/identifiers";
import {
  checkAnswer,
  getDailyGrid,
  type CheckAnswerDto,
  type DailyGridDto,
} from "../../use-cases/daily-grid";
import { defineGameMode } from "../registry";
import type { RegisteredGameMode } from "../types";

/**
 * 3×3 ızgara modu — PROJECT.md §9.1.
 *
 * NEDEN TEK MOD, İKİ EYLEM. `GameMode` sözleşmesi tek bir `execute` taşır
 * (§9); ızgaranın ise iki işlemi var: günün ızgarasını vermek ve bir cevabı
 * doğrulamak. İkisini ayrı mod diye kaydetmek yanlış olurdu — aynı oyunun
 * aynı kurallarını paylaşıyorlar ve "ızgara modu" tek bir üründür.
 *
 * Bu yüzden girdi AYIRT EDİCİ BİRLEŞİMDİR (`action`). Sözleşme değişmiyor,
 * mod kendi komut kümesini kendi şemasında tarif ediyor. Zod'un
 * `discriminatedUnion`'ı, `action` değeri tanınmayan bir girdiyi ayrıştırma
 * aşamasında reddeder; `execute` içine geçersiz bir eylem ulaşamaz (§2.3).
 *
 * ZAMANIN KAYNAĞI SUNUCUDUR. Girdide tarih alanı YOK ve olmayacak: istemci
 * tarih gönderebilseydi yarının ızgarasını bugünden çekebilir ya da geçmiş bir
 * günü tekrar oynayabilirdi. Gün, `execute` içinde `new Date()` ile okunur.
 */

const cellSchema = z.object({
  row: z
    .int()
    .min(0)
    .max(GRID_SIZE - 1),
  column: z
    .int()
    .min(0)
    .max(GRID_SIZE - 1),
});

export const gridInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("daily") }),
  z.object({
    action: z.literal("answer"),
    cell: cellSchema,
    // Ham dize markalı `PlayerId`'ye BURADA dönüşür — sınır tam olarak burası.
    playerId: z.string().refine(isValidIdentifier).transform(playerId),
  }),
]);

export type GridInput = z.output<typeof gridInputSchema>;
export type GridOutput = DailyGridDto | CheckAnswerDto;

export const GRID_MODE_ID = "grid";

export const gridMode: RegisteredGameMode = defineGameMode<
  GridInput,
  GridOutput
>({
  id: GRID_MODE_ID,
  title: "3×3 Izgara",
  inputSchema: gridInputSchema,

  execute(input, deps) {
    const now = new Date();

    return input.action === "daily"
      ? getDailyGrid(now, deps)
      : checkAnswer({ now, cell: input.cell, playerId: input.playerId }, deps);
  },
});
