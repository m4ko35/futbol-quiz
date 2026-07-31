"use client";

import { useCallback } from "react";
import type { PlayerDto } from "@/application/dto/player-dto";
import type { DailyStatMatchDto } from "@/application/use-cases/daily-stat-match";
import type { StatKey } from "@/domain/services/stat-match";
import { StatMatchGame } from "./stat-match-game";

/**
 * `StatMatchGame`'i gerçek API uçlarına bağlayan ince katman.
 *
 * `GridQuiz` ile aynı gerekçe: oyun bileşeni nereden veri geldiğini bilmez,
 * sayfa da sunucu bileşeni olarak kalabilir (sunucu bileşeni istemciye
 * fonksiyon geçiremez).
 */

export interface StatMatchQuizProps {
  readonly daily: DailyStatMatchDto;
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

export function StatMatchQuiz({ daily }: StatMatchQuizProps) {
  /**
   * BR-16 — arama, AÇIK OLAN istatistikte puanlanabilir oyuncularla sınırlanır.
   *
   * Süzgeç olmadan seçici, verisi olmayan oyuncuları da listeliyordu: "Buffon"
   * araması alfabetik sırayla önce "Armando Buffon"u getiriyor, kullanıcı onu
   * seçiyor ve sunucu haklı olarak reddediyordu. Oyun bir duvara dönüşüyordu.
   */
  const searchPlayers = useCallback(
    async (
      term: string,
      signal: AbortSignal,
      statKey: StatKey,
    ): Promise<PlayerDto[]> => {
      const params = new URLSearchParams({ q: term, stat: statKey });
      const response = await fetch(`/api/players?${params.toString()}`, {
        signal,
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));

      const body = (await response.json()) as { data: PlayerDto[] };
      return body.data;
    },
    [],
  );

  const submitAnswer = useCallback(
    async (
      statKey: StatKey,
      playerId: string,
    ): Promise<{ value: number; score: number }> => {
      const response = await fetch("/api/stat-match/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statKey, playerId }),
      });
      // Hata mesajı OLDUĞU GİBİ yukarı taşınır: "bu oyuncunun verisi yok"
      // (BR-16) kullanıcının görmesi gereken bir bilgidir.
      if (!response.ok) throw new Error(await readErrorMessage(response));

      const body = (await response.json()) as {
        data: { value: number; score: number };
      };
      return body.data;
    },
    [],
  );

  return (
    <StatMatchGame
      daily={daily}
      submitAnswer={submitAnswer}
      searchPlayers={searchPlayers}
    />
  );
}
