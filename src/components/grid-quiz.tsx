"use client";

import { useCallback } from "react";
import type { PlayerDto } from "@/application/dto/player-dto";
import type { DailyGridDto } from "@/application/use-cases/daily-grid";
import type { CellRef } from "@/domain/services/grid";
import { GridGame } from "./grid-game";

/**
 * `GridGame`'i gerçek API uçlarına bağlayan ince katman.
 *
 * NEDEN AYRI: `GridGame` oyunun kurallarını ve durumunu tutar; nereden veri
 * geldiğini bilmez. Bu ayrım testlerde ödüyor — oyunun davranışı sahte iki
 * fonksiyonla, ağ olmadan sınanabiliyor. Sayfa da sunucu bileşeni olarak
 * kalabiliyor: sunucu bileşeni istemciye fonksiyon geçiremez, bu sarmalayıcı
 * o sınırı taşıyor.
 */

export interface GridQuizProps {
  readonly grid: DailyGridDto;
}

/** API hata gövdesinden kullanıcıya gösterilebilir mesajı çıkarır (§6.3). */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "object"
    ) {
      const error = (body as { error: { message?: unknown } }).error;
      if (typeof error.message === "string") return error.message;
    }
  } catch {
    // Gövde JSON değilse aşağıdaki genel mesaja düşülür.
  }
  return "İstek tamamlanamadı. Lütfen tekrar deneyin.";
}

export function GridQuiz({ grid }: GridQuizProps) {
  const searchPlayers = useCallback(
    async (term: string, signal: AbortSignal): Promise<PlayerDto[]> => {
      const response = await fetch(
        `/api/players?q=${encodeURIComponent(term)}`,
        { signal },
      );
      if (!response.ok) throw new Error(await readErrorMessage(response));

      const body = (await response.json()) as { data: PlayerDto[] };
      return body.data;
    },
    [],
  );

  const checkAnswer = useCallback(
    async (cell: CellRef, playerId: string): Promise<boolean> => {
      const response = await fetch("/api/grid/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cell, playerId }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));

      const body = (await response.json()) as { data: { correct: boolean } };
      return body.data.correct;
    },
    [],
  );

  return (
    <GridGame
      grid={grid}
      checkAnswer={checkAnswer}
      searchPlayers={searchPlayers}
    />
  );
}
