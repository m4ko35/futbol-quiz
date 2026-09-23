"use client";

import { useCallback, useState } from "react";
import type { PlayerDto } from "@/application/dto/player-dto";
import type {
  DailyStatMatchDto,
  StatMatchRoundDto,
} from "@/application/use-cases/daily-stat-match";
import type { StatKey } from "@/domain/services/stat-match";
import { PlayerPicker } from "./player-picker";
import { Button } from "./ui/button";
import { formatTurkishIsoDate } from "@/lib/format-date";
import { readErrorMessage } from "@/lib/http/error-message";
import { searchPlayersForStat, searchTargets } from "@/lib/http/player-search";
import { StatMatchGame, type StatMatchGameProps } from "./stat-match-game";

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
  /**
   * Sunucuda saklanan günlük tur — yalnızca giriş yapmışsa (§11, BR-43).
   *
   * YALNIZCA GÜNLÜK TURA geçirilir. "Sen seç" turu kaydedilmiyor; oraya da
   * vermek, kaydedilmeyen bir turu kaydedilmiş gibi göstermek olurdu.
   */
  readonly serverAnswers?: StatMatchGameProps["serverAnswers"];
  /**
   * Günlük turun kaydedilme durumu (§11.11).
   *
   * Saklanan tur alanıyla AYNI GEREKÇE: yalnızca günlük tura geçirilir. "Sen
   * seç" turunda kayıttan söz etmek, kaydedilebileceği izlenimi verirdi.
   */
  readonly recording?: StatMatchGameProps["recording"];
  /**
   * Günlük turun istatistik satırlarının üstüne giren şerit — bugün odaya
   * çağrı (§12.7).
   *
   * YALNIZCA GÜNLÜK TURA geçirilir. "Sen seç" turunda ikinci kez göstermek,
   * aynı çağrıyı aynı sayfada tekrarlamak olurdu.
   */
  readonly beforeStats?: StatMatchGameProps["beforeStats"];
}

export function StatMatchQuiz({
  daily,
  serverAnswers,
  recording,
  beforeStats,
}: StatMatchQuizProps) {
  const [chosen, setChosen] = useState<StatMatchRoundDto | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

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
        {...(serverAnswers === undefined ? {} : { serverAnswers })}
        {...(recording === undefined ? {} : { recording })}
        {...(beforeStats === undefined ? {} : { beforeStats })}
        header={{
          // Yalnızca TARİH — gerekçe `grid-quiz.tsx`'teki ikiziyle aynı.
          eyebrow: formatTurkishIsoDate(daily.date),
          title: "Günün Oyuncusu",
          // HIZLI ÇAPALAR — "Sen seç" ve "Nasıl oynanır" bölümlerine iner
          // (ızgaradaki künye kısayollarının karşılığı, §9.2). Bölümler zaten
          // var; bu yalnızca uzun sayfada onlara atlama kolaylığı.
          actions: <StatHeaderLinks />,
        }}
        submitAnswer={submitDaily}
        searchPlayers={searchPlayersForStat}
      />

      <section
        id="sen-sec"
        className="flex scroll-mt-24 flex-col gap-4 border-t border-line pt-8"
      >
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
              <Button
                size="md"
                loading={isLoading}
                className="w-fit"
                onClick={() => {
                  setIsPicking(true);
                  setFailure(null);
                }}
              >
                Oyuncu seç
              </Button>
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
            searchPlayers={searchPlayersForStat}
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

/** Künye kısayol linki — condensed pill (ızgaradaki `GridHeaderLinks` idyomu). */
const HEADER_LINK_CLASS =
  "font-display inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-2 text-sm font-semibold tracking-wide text-muted uppercase transition-colors hover:border-line-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Künye kısayolları — "Sen seç" ve "Nasıl oynanır" bölümlerine iner (§9.2).
 *
 * Bölümler uzun sayfada zaten var; bu çapa linkleri Stitch künyesindeki iki
 * kısayolun karşılığı, yeni bir yüzey/kural değil — yalnızca gezinme kolaylığı.
 * İkonlar satır içi SVG (§7.12: harici font/glif değil; CSP `font-src 'self'`).
 */
function StatHeaderLinks() {
  return (
    <nav
      aria-label="İstatistik kısayolları"
      className="flex flex-wrap items-center gap-2"
    >
      <a href="#sen-sec" className={HEADER_LINK_CLASS}>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className="h-4 w-4 text-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span>Sen seç</span>
      </a>
      <a href="#nasil-oynanir" className={HEADER_LINK_CLASS}>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className="h-4 w-4 text-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.5v.3" />
          <path d="M12 17h.01" />
        </svg>
        <span>Nasıl oynanır?</span>
      </a>
    </nav>
  );
}
