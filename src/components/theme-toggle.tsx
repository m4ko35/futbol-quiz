"use client";

import { useSyncExternalStore } from "react";
import {
  readThemeChoice,
  readThemeChoiceOnServer,
  subscribeToThemeChoice,
  writeThemeChoice,
  type ThemeChoice,
} from "@/lib/theme";

/**
 * Görünüm seçicisi — PROJECT.md §7.12.
 *
 * NEDEN ÜÇ SEÇENEK. `Sistem` öntanımlıdır; `Açık` ve `Koyu` onu geçersiz kılar.
 * İki durumlu bir anahtar, sistemi izleme davranışına GERİ DÖNMEYİ imkânsız
 * kılardı — bir kez dokunan kullanıcı ömür boyu elle seçmek zorunda kalırdı.
 *
 * NEDEN GERÇEK RADYO DÜĞMELERİ. Üçü birbirini dışlayan tek bir seçim; klavye
 * gezinmesi (ok tuşlarıyla dolaşma, tek sekme durağı) ve "3 seçenekten 2.'si"
 * bildirimi tarayıcıdan HAZIR gelir. `aria-pressed`'li üç düğme aynı bilgiyi
 * "basılı / basılı değil" diye üç ayrı parça hâlinde verirdi.
 *
 * NEDEN `useSyncExternalStore`. `localStorage` bir DIŞ SİSTEMDİR ve sunucuda
 * yoktur. Render sırasında okumak sunucu ile istemci çıktısını ayrıştırır,
 * efekt içinde okuyup `setState` çağırmak basamaklı render üretir; React'in bu
 * iş için tanımladığı arayüz budur (§9.1'deki günlük oyun durumuyla aynı
 * karar). SAYFANIN TEMASI bu geçişten etkilenmiyor — onu `<head>`'deki açılış
 * script'i ilk boyamadan önce basıyor; geçiş yalnızca bu küçük denetimin hangi
 * seçeneği dolu göstereceğini ilgilendirir.
 */

const OPTIONS: readonly {
  readonly id: ThemeChoice;
  readonly label: string;
  readonly icon: React.ReactNode;
}[] = [
  {
    id: "system",
    label: "Sistem",
    // Yarısı dolu çember: "iki temadan hangisi olduğuna başkası karar veriyor".
    icon: (
      <>
        <circle cx="8" cy="8" r="6" fill="none" strokeWidth="1.6" />
        <path d="M8 2a6 6 0 0 0 0 12z" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    id: "light",
    label: "Açık",
    icon: (
      <>
        <circle cx="8" cy="8" r="3.2" fill="none" strokeWidth="1.6" />
        <path
          d="M8 1v1.8M8 13.2V15M1 8h1.8M13.2 8H15M3 3l1.3 1.3M11.7 11.7 13 13M13 3l-1.3 1.3M4.3 11.7 3 13"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </>
    ),
  },
  {
    id: "dark",
    label: "Koyu",
    icon: (
      <path
        d="M13.4 9.6A6 6 0 0 1 6.4 2.6a6 6 0 1 0 7 7z"
        fill="currentColor"
        stroke="none"
      />
    ),
  },
];

export interface ThemeToggleProps {
  readonly className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const choice = useSyncExternalStore(
    subscribeToThemeChoice,
    readThemeChoice,
    readThemeChoiceOnServer,
  );

  return (
    <fieldset
      className={
        "flex items-center gap-0.5 rounded-full border border-line bg-background p-1 " +
        (className ?? "")
      }
    >
      {/*
        Görünen bir başlık YOK ama erişilebilir ad zorunlu: üç simgenin neyi
        seçtiğini söyleyen tek şey grubun adı.
      */}
      <legend className="sr-only">Görünüm</legend>

      {OPTIONS.map((option) => {
        const isCurrent = option.id === choice;
        return (
          <label
            key={option.id}
            className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
              isCurrent
                ? "bg-accent text-accent-fg shadow-card"
                : "text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            <input
              type="radio"
              name="theme-choice"
              className="sr-only"
              value={option.id}
              checked={isCurrent}
              onChange={() => {
                writeThemeChoice(option.id);
              }}
            />
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
              className="h-4 w-4"
              stroke="currentColor"
              fill="none"
            >
              {option.icon}
            </svg>
            <span className="sr-only">{option.label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
