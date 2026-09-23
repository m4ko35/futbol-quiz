"use client";

import { useCallback, useState } from "react";
import type { LeaderboardPeriod } from "@/domain/services/leaderboard";

/**
 * "Sıralamanı paylaş" — PROJECT.md §11.5 (Sunum).
 *
 * Kullanıcının KENDİ sırasını paylaşır: dönem + sıra + puan + link. Başka
 * modların paylaşımıyla aynı kural — nadirlik/percentil/sıralama geçmişi YOK,
 * yalnızca elimizdeki dört alandan ikisi (rank, points). Bu tek etkileşimli
 * parça istemci; tablonun geri kalanı sunucuda render edilir (§11.7,
 * "benim sıram" ayrı istenir).
 *
 * Emoji YALNIZCA paylaş metninde (§7.12); arayüzde satır içi SVG ikon.
 */
export function LeaderboardShareButton({
  rank,
  points,
  periodLabel,
  period,
}: {
  readonly rank: number;
  readonly points: number;
  /** Dönemin görünen adı ("Bugün" / "Bu hafta" / "Tüm zamanlar"). */
  readonly periodLabel: string;
  readonly period: LeaderboardPeriod;
}) {
  const [status, setStatus] = useState<string | null>(null);

  const share = useCallback(async (): Promise<void> => {
    const head = "Futbol Challenge — Lider Tablosu";
    const line = `${periodLabel}: #${String(rank)} · ${String(points)} puan`;
    const url = `${window.location.origin}/lider-tablosu?donem=${period}`;
    const text = [head, line, "", url].join("\n");

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        setStatus("Paylaşıldı.");
        return;
      } catch {
        // iptal / hata: panoya kopyalamaya düş.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Sıralama panoya kopyalandı.");
    } catch {
      setStatus("Paylaşım bu tarayıcıda desteklenmiyor.");
    }
  }, [rank, points, periodLabel, period]);

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={() => void share()}
        className="font-display inline-flex items-center gap-1.5 rounded-md border border-accent bg-surface px-3 py-2 text-sm font-semibold tracking-wide text-accent uppercase transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
          <path d="M12 15V3M8 7l4-4 4 4" />
        </svg>
        <span>Sıralamanı paylaş</span>
      </button>

      {status !== null && (
        <span role="status" aria-live="polite" className="text-xs text-muted">
          {status}
        </span>
      )}
    </div>
  );
}
