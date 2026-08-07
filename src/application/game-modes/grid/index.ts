import { z } from "zod";
import { GRID_SIZE, MAX_GRID_SIZE } from "@/domain/services/grid";
import {
  isValidIdentifier,
  playerId,
} from "@/domain/value-objects/identifiers";
import {
  checkCustomAnswer,
  listPlayableCriteria,
  type GridCriterionRefDto,
} from "../../use-cases/custom-grid";
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

/**
 * Ölçüt referansı — "Sen kur" (BR-25, BR-26).
 *
 * TÜRE GÖRE AYRI ŞEKİL. Kulüp kimliği ile ülke kodu aynı alanda taşınır ama
 * aynı şey DEĞİLDİR: biri `cuid`, diğeri iki harfli bir ülke kodu. Tek bir
 * `string` kabul edilseydi biçim denetimi sınırdan içeri, use-case'e kayardı
 * (§2.3).
 */
const criterionRefSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("club"),
    id: z.string().refine(isValidIdentifier),
  }),
  z.object({
    kind: z.literal("nationality"),
    id: z.string().regex(/^[A-Z]{2}$/),
  }),
]);

export const gridInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("daily") }),
  z.object({
    action: z.literal("criteria"),
    // Kullanıcı ızgarası 5×5'e kadar çıkabilir (BR-27); günlük ızgaranın
    // hücre şeması (`cellSchema`) ise 3×3 kalır.
    against: z.array(criterionRefSchema).min(1).max(MAX_GRID_SIZE),
    term: z.string().optional(),
    limit: z.number().optional(),
  }),
  z.object({
    action: z.literal("custom-answer"),
    row: criterionRefSchema,
    column: criterionRefSchema,
    playerId: z.string().refine(isValidIdentifier).transform(playerId),
  }),
  z.object({
    action: z.literal("answer"),
    cell: cellSchema,
    // Ham dize markalı `PlayerId`'ye BURADA dönüşür — sınır tam olarak burası.
    playerId: z.string().refine(isValidIdentifier).transform(playerId),
  }),
]);

export type GridInput = z.output<typeof gridInputSchema>;
export type GridOutput = DailyGridDto | CheckAnswerDto | GridCriterionRefDto[];

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

    switch (input.action) {
      case "daily":
        return getDailyGrid(now, deps);
      case "criteria":
        return listPlayableCriteria(
          { against: input.against, term: input.term, limit: input.limit },
          deps,
        );
      case "custom-answer":
        return checkCustomAnswer(
          { row: input.row, column: input.column, playerId: input.playerId },
          deps,
        );
      case "answer":
        return checkAnswer(
          { now, cell: input.cell, playerId: input.playerId },
          deps,
        );
    }
  },
});
