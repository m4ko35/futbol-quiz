"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { PlayerDto } from "@/application/dto/player-dto";
import type {
  DailyStatMatchDto,
  StatDto,
} from "@/application/use-cases/daily-stat-match";
import {
  isRoundComplete,
  STAT_KEYS,
  totalScore,
  type StatKey,
} from "@/domain/services/stat-match";
import { countryName } from "@/lib/country-name";
import {
  parseStatMatch,
  readStatMatch,
  readStatMatchOnServer,
  subscribeToStatMatch,
  writeStatMatch,
  type StatMatchState,
} from "@/lib/stat-match-storage";
import { PlayerPicker } from "./player-picker";

/**
 * İstatistik eşleştirme oyunu — PROJECT.md §9.2.
 *
 * BU BİLEŞEN PUAN HESAPLAMAZ. Puanı sunucu verir (BR-20); burada yalnızca
 * gösterilir ve saklanır. Formülü istemcide tekrarlamak, iki yerde ayrı ayrı
 * yazılmış bir kural demekti ve er geç ayrışırdı.
 *
 * BR-17 (bir oyuncu bir kez) yalnızca istemcide zorlanıyor — ızgaradaki
 * BR-10 ile aynı sınır ve aynı gerekçe (§9.1).
 */

export interface StatMatchGameProps {
  readonly daily: DailyStatMatchDto;
  /** Cevap gönderimi; testlerde sahte bir uygulama verilir. */
  submitAnswer(
    statKey: StatKey,
    playerId: string,
  ): Promise<{ value: number; score: number }>;
  /**
   * `statKey` ile çağrılır: BR-16 gereği arama, o istatistikte puanlanabilir
   * oyuncularla sınırlanmalı (§9.2).
   */
  searchPlayers(
    term: string,
    signal: AbortSignal,
    statKey: StatKey,
  ): Promise<PlayerDto[]>;
}

function emptyRound(date: string): StatMatchState {
  return { date, answers: {} };
}

/**
 * Ad → baş harfler. "Éric Cantona" → "EC".
 *
 * Türkçe yerel ayarla büyütülüyor: `toUpperCase()` "ı" harfini "I" değil
 * "I" yapar ama "i" harfini "I" yapar ve Türkçede doğrusu "İ"dir. Adlar
 * çoğunlukla yabancı olsa da yanlışın maliyeti sıfırken doğrusunu yazmamak
 * için sebep yok.
 */
function initialsOf(name: string): string {
  const parts = name.split(/\s+/u).filter((part) => part.length > 0);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toLocaleUpperCase("tr");
}

/**
 * Puan bandına göre rozet rengi.
 *
 * Eşikler KEYFİ DEĞİL, §9.2'deki puanlama eğrisinden: %80 ve üzeri "isabet",
 * %50–79 "yakın", altı "uzak". Renk yalnızca destekleyicidir — yüzde değeri
 * rozetin metninde zaten yazılı (WCAG 1.4.1).
 */
function scoreTone(score: number): string {
  if (score >= 80) return "bg-correct-soft text-correct";
  if (score >= 50) return "bg-warn-soft text-warn";
  return "bg-wrong-soft text-wrong";
}

export function StatMatchGame({
  daily,
  submitAnswer,
  searchPlayers,
}: StatMatchGameProps) {
  const raw = useSyncExternalStore(
    subscribeToStatMatch,
    readStatMatch,
    readStatMatchOnServer,
  );

  const state = useMemo(
    () => parseStatMatch(raw, daily.date) ?? emptyRound(daily.date),
    [raw, daily.date],
  );

  const [openStat, setOpenStat] = useState<StatKey | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const answers = Object.entries(state.answers) as [
    StatKey,
    NonNullable<StatMatchState["answers"][StatKey]>,
  ][];
  const finished = isRoundComplete(answers.length);
  const total = totalScore(answers.map(([, answer]) => answer.score));

  // BR-17 — kullanılmış oyuncular ve günün oyuncusunun kendisi seçilemez.
  const usedPlayerIds = new Set([
    daily.player.id,
    ...answers.map(([, answer]) => answer.playerId),
  ]);

  const submit = useCallback(
    async (statKey: StatKey, player: PlayerDto): Promise<void> => {
      setOpenStat(null);
      setIsChecking(true);
      setFailure(null);

      try {
        const result = await submitAnswer(statKey, player.id);

        // Güncel durum YAZMA ANINDA okunur; bekleyen isteğin başladığı andaki
        // kopyanın üzerine yazmak, arada tamamlanan bir cevabı silerdi.
        const current =
          parseStatMatch(readStatMatch(), daily.date) ?? emptyRound(daily.date);

        writeStatMatch({
          date: current.date,
          answers: {
            ...current.answers,
            [statKey]: {
              playerId: player.id,
              playerName: player.name,
              value: result.value,
              score: result.score,
            },
          },
        });
      } catch (error: unknown) {
        // Sunucu "bu oyuncunun verisi yok" diyorsa (BR-16) bunu OLDUĞU GİBİ
        // göster: kullanıcı neden reddedildiğini bilmeli, yoksa aynı hatayı
        // tekrarlar.
        setFailure(
          error instanceof Error && error.message.length > 0
            ? error.message
            : "Cevap gönderilemedi. Lütfen tekrar deneyin.",
        );
      } finally {
        setIsChecking(false);
      }
    },
    [submitAnswer, daily.date],
  );

  const openStatDto =
    openStat === null
      ? undefined
      : daily.stats.find((stat) => stat.key === openStat);

  // `PlayerPicker` iki argümanlı bir arama bekler; açık istatistiği buraya
  // kapatarak taşıyoruz. `useMemo` olmadan her render yeni bir fonksiyon
  // üretir ve seçicinin arama efekti sürekli yeniden çalışırdı.
  const searchForOpenStat = useMemo(
    () =>
      openStat === null
        ? null
        : (term: string, signal: AbortSignal) =>
            searchPlayers(term, signal, openStat),
    [openStat, searchPlayers],
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card">
        {/* Baş harfler: günün oyuncusu ekranın ÖZNESİ ama tek satır metin
            olarak duruyordu. Fotoğraf yok (veri kümesi taşımıyor); baş harf
            en azından bir çapa veriyor. Süsleme olduğu için `aria-hidden`. */}
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl font-bold text-accent"
        >
          {initialsOf(daily.player.name)}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight">
            {daily.player.name}
            {daily.player.nationality !== null && (
              <span className="ml-2 text-sm font-normal text-muted">
                {countryName(daily.player.nationality)}
              </span>
            )}
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Her istatistik için, değeri buna{" "}
            <strong className="font-semibold text-foreground">en yakın</strong>{" "}
            olduğunu düşündüğünüz{" "}
            <strong className="font-semibold text-foreground">farklı</strong>{" "}
            bir futbolcu seçin.
          </p>
        </div>
      </section>

      <p
        className="w-fit rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold tabular-nums shadow-card"
        aria-live="polite"
      >
        {String(answers.length)}/{String(STAT_KEYS.length)} cevaplandı
        {answers.length > 0 && ` · ortalama %${String(total)}`}
      </p>

      <ul className="flex flex-col gap-3">
        {daily.stats.map((stat) => (
          <StatRow
            key={stat.key}
            stat={stat}
            answer={state.answers[stat.key]}
            disabled={isChecking || state.answers[stat.key] !== undefined}
            isOpen={openStat === stat.key}
            onOpen={() => {
              setOpenStat(stat.key);
            }}
          />
        ))}
      </ul>

      {isChecking && (
        <p className="text-sm text-muted" aria-live="polite">
          Puan hesaplanıyor…
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

      {openStat !== null &&
        openStatDto !== undefined &&
        searchForOpenStat !== null &&
        !finished && (
          <PlayerPicker
            label={`${openStatDto.label} için oyuncu seçin (hedef ${String(openStatDto.value)})`}
            usedPlayerIds={usedPlayerIds}
            search={searchForOpenStat}
            onSelect={(player) => {
              void submit(openStat, player);
            }}
            onCancel={() => {
              setOpenStat(null);
            }}
          />
        )}

      {finished && (
        <p
          role="status"
          className="rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm"
        >
          Tur bitti — ortalama <strong>%{String(total)}</strong>. Yeni oyuncu
          her gün 03.00&apos;te (TSİ) yayınlanır.
        </p>
      )}

      {/*
        KAPSAM BİLDİRİMİ (§1.3, §9.2). Maç/gol/kulüp sayıları yalnızca yirmi
        dört ligi kapsar; söylenmezse kullanıcı bildiği gerçek toplamla
        karşılaştırıp siteyi yanlış sanar.
      */}
      <p className="text-xs text-muted">
        <span aria-hidden="true">*</span> işaretli sayılar yalnızca kapsanan
        yirmi dört ligdeki kariyeri kapsar.
      </p>
    </div>
  );
}

interface StatRowProps {
  readonly stat: StatDto;
  readonly answer: StatMatchState["answers"][StatKey];
  readonly disabled: boolean;
  readonly isOpen: boolean;
  onOpen(): void;
}

function StatRow({ stat, answer, disabled, isOpen, onOpen }: StatRowProps) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 shadow-card">
      <span className="flex flex-col">
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">
          {stat.label}
          {stat.scoped && (
            <>
              <span aria-hidden="true">*</span>
              <span className="sr-only"> (yalnızca yirmi dört lig)</span>
            </>
          )}
        </span>
        {/* Hedef sayı ekranın SORUSUDUR; etiketiyle aynı ağırlıkta durduğunda
            hangi değeri yakalamaya çalıştığınız bir bakışta okunmuyordu. */}
        <span className="text-3xl font-bold text-accent tabular-nums">
          {String(stat.value)}
        </span>
      </span>

      {answer === undefined ? (
        <button
          type="button"
          disabled={disabled}
          aria-expanded={isOpen}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
          onClick={onOpen}
        >
          Oyuncu seç
          <span className="sr-only"> — {stat.label}</span>
        </button>
      ) : (
        <span className="flex flex-col items-end gap-1 text-sm">
          <span className="font-semibold">{answer.playerName}</span>
          {/* Puan bandı RENKLE de gösterilir ama renk tek gösterge değildir
              (WCAG 1.4.1): yüzde zaten rozetin metninde yazılı. */}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreTone(
              answer.score,
            )}`}
          >
            {String(answer.value)} · %{String(answer.score)}
          </span>
          <span className="sr-only">
            {stat.label}: {answer.playerName}, değeri {String(answer.value)},
            puan yüzde {String(answer.score)}
          </span>
        </span>
      )}
    </li>
  );
}
