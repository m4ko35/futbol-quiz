"use client";

import { useCallback, useState } from "react";
import type { PlayerDto } from "@/application/dto/player-dto";
import type {
  DailyStatMatchDto,
  StatMatchRoundDto,
} from "@/application/use-cases/daily-stat-match";
import type { StatKey } from "@/domain/services/stat-match";
import { PlayerPicker } from "./player-picker";
import { StatMatchGame } from "./stat-match-game";

/**
 * `StatMatchGame`'i gerçek API uçlarına bağlayan ince katman.
 *
 * `GridQuiz` ile aynı gerekçe: oyun bileşeni nereden veri geldiğini bilmez,
 * sayfa da sunucu bileşeni olarak kalabilir (sunucu bileşeni istemciye
 * fonksiyon geçiremez).
 *
 * İKİ GİRİŞ (§9.2): günün turu her zaman açıktır; altındaki "Sen seç" bölümü
 * kullanıcının kendi hedefini seçmesine izin verir. İkisi AYNI oyun
 * bileşenini kullanır — kurallar tek yerde kalsın diye.
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
  const [chosen, setChosen] = useState<StatMatchRoundDto | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

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

  /**
   * BR-24 — hedef arayışı. `target=true` olmadan ilk 20 sonucun yalnızca
   * %18–50'si seçilebilir çıkıyordu (§9.2'de ölçüldü); süzgeç, sunucunun
   * reddedeceği isimleri listeden baştan çıkarır.
   */
  const searchTargets = useCallback(
    async (term: string, signal: AbortSignal): Promise<PlayerDto[]> => {
      const params = new URLSearchParams({ q: term, target: "true" });
      const response = await fetch(`/api/players?${params.toString()}`, {
        signal,
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));

      const body = (await response.json()) as { data: PlayerDto[] };
      return body.data;
    },
    [],
  );

  const submitDaily = useCallback(
    async (
      statKey: StatKey,
      playerId: string,
    ): Promise<{ value: number; score: number }> =>
      postAnswer({ statKey, playerId }),
    [],
  );

  /**
   * "Sen seç" cevabı hedefin KİMLİĞİNİ taşır, değerlerini değil (BR-20).
   * Sunucu hedefi yeniden çözer ve puanı kendisi hesaplar.
   */
  const submitChosen = useCallback(
    async (
      statKey: StatKey,
      playerId: string,
    ): Promise<{ value: number; score: number }> => {
      if (chosen === null) throw new Error("Hedef seçilmedi.");
      return postAnswer({ statKey, playerId, targetId: chosen.player.id });
    },
    [chosen],
  );

  const pickTarget = useCallback(async (player: PlayerDto): Promise<void> => {
    setIsPicking(false);
    setIsLoading(true);
    setFailure(null);

    try {
      const params = new URLSearchParams({ playerId: player.id });
      const response = await fetch(
        `/api/stat-match/target?${params.toString()}`,
      );
      // BR-24 — ret gerekçesi OLDUĞU GİBİ gösterilir; başka oyuncuya
      // kaydırmak kullanıcının aradığını bulduğunu sanmasına yol açardı.
      if (!response.ok) throw new Error(await readErrorMessage(response));

      const body = (await response.json()) as { data: StatMatchRoundDto };
      setChosen(body.data);
    } catch (error: unknown) {
      setFailure(
        error instanceof Error && error.message.length > 0
          ? error.message
          : "Oyuncu getirilemedi. Lütfen tekrar deneyin.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col gap-10">
      <StatMatchGame
        round={daily}
        date={daily.date}
        submitAnswer={submitDaily}
        searchPlayers={searchPlayers}
      />

      <section className="flex flex-col gap-4 border-t border-line pt-8">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Sen seç</h2>
          <p className="mt-1.5 text-sm text-muted">
            Günün oyuncusunu beklemeden kendi hedefinizi seçin. Bu tur{" "}
            <strong className="font-semibold text-foreground">
              kaydedilmez
            </strong>
            ; istediğiniz kadar oynayabilirsiniz.
          </p>
        </div>

        {chosen === null ? (
          <>
            {!isPicking && (
              <button
                type="button"
                disabled={isLoading}
                className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => {
                  setIsPicking(true);
                  setFailure(null);
                }}
              >
                Oyuncu seç
              </button>
            )}

            {isPicking && (
              <PlayerPicker
                label="Hedef oyuncuyu seçin"
                usedPlayerIds={EMPTY_IDS}
                search={searchTargets}
                onSelect={(player) => {
                  void pickTarget(player);
                }}
                onCancel={() => {
                  setIsPicking(false);
                }}
              />
            )}
          </>
        ) : (
          <StatMatchGame
            round={chosen}
            submitAnswer={submitChosen}
            searchPlayers={searchPlayers}
            onRestart={() => {
              setChosen(null);
              setIsPicking(true);
            }}
          />
        )}

        {isLoading && (
          <p className="text-sm text-muted" aria-live="polite">
            Oyuncu getiriliyor…
          </p>
        )}

        {failure !== null && (
          <p
            role="alert"
            className="rounded-xl border border-wrong bg-wrong-soft px-4 py-3 text-sm text-wrong"
          >
            {failure}
          </p>
        )}
      </section>
    </div>
  );
}

/** Hedef seçiminde "kullanılmış oyuncu" kavramı yok; sabit boş küme. */
const EMPTY_IDS: ReadonlySet<string> = new Set<string>();

async function postAnswer(body: {
  statKey: StatKey;
  playerId: string;
  targetId?: string;
}): Promise<{ value: number; score: number }> {
  const response = await fetch("/api/stat-match/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // Hata mesajı OLDUĞU GİBİ yukarı taşınır: "bu oyuncunun verisi yok"
  // (BR-16) kullanıcının görmesi gereken bir bilgidir.
  if (!response.ok) throw new Error(await readErrorMessage(response));

  const payload = (await response.json()) as {
    data: { value: number; score: number };
  };
  return payload.data;
}
