"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WhichMorePairDto } from "@/application/use-cases/which-more";
import type {
  WhichMoreOpponentDto,
  WhichMoreRevealedPick,
  WhichMoreRoomDto,
} from "@/application/use-cases/which-more-rooms";
import { readErrorMessage } from "@/lib/http/error-message";
import { pollDelay } from "@/lib/room-polling";
import {
  whichMorePollPhase,
  whichMorePollSignature,
} from "@/lib/which-more-room-polling";
import { DataLabel } from "./data-label";
import { ModeHeader, Scoreboard } from "./mode-header";
import {
  ConnectionNote,
  RoomCodeCard,
  useRemainingMinutes,
} from "./room-board";
import { Button } from "./ui/button";
import { levelFor, questionFor } from "./which-more-quiz";

/**
 * Hangisi Daha odası ekranı — PROJECT.md §12.8.
 *
 * İstatistik odasının (`room-board.tsx`) kardeşi: aynı yoklama motoru (görünmez
 * sekme durur, sekmeye dönünce hemen yoklar, sessizlikte yavaşlar), aynı kod
 * kartı ve süre sayacı ORADAN paylaşılıyor. Değişen tek şey oyun: hedef yerine
 * DÜELLO, altı istatistik yerine SERİ/DOĞRU sayısı, ve BR-70'in rakip gizleme
 * kuralı.
 */

const FAILURES_BEFORE_WARNING = 2;

export interface WhichMoreRoomBoardProps {
  readonly initialRoom: WhichMoreRoomDto;
}

/** Az önce cevaplanan düellonun açığa çıkmış hâli — "Devam"a kadar durur. */
interface Reveal {
  readonly duel: WhichMorePairDto;
  readonly chosenId: string;
  readonly correct: boolean;
}

export function WhichMoreRoomBoard({ initialRoom }: WhichMoreRoomBoardProps) {
  const [room, setRoom] = useState(initialRoom);
  const [failures, setFailures] = useState(0);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const code = room.code;
  const phase = whichMorePollPhase(room);

  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  // Yoklama döngüsü — `room-board.tsx` ile birebir aynı desen (§12.1).
  useEffect(() => {
    if (phase === null) return;

    let stopped = false;
    let quiet = 0;
    let last = whichMorePollSignature(roomRef.current);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wake: (() => void) | null = null;
    const controller = new AbortController();

    const sleep = (ms: number): Promise<void> =>
      new Promise<void>((resolve) => {
        wake = resolve;
        timer = setTimeout(resolve, ms);
      });

    const onVisibility = (): void => {
      if (document.visibilityState !== "visible") return;
      quiet = 0;
      if (timer !== undefined) clearTimeout(timer);
      wake?.();
    };

    document.addEventListener("visibilitychange", onVisibility);

    const loop = async (): Promise<void> => {
      while (!stopped) {
        await sleep(pollDelay(phase, quiet));
        if (stopped) return;
        if (document.visibilityState === "hidden") {
          quiet = 0;
          continue;
        }

        try {
          const response = await fetch(`/api/oda/${encodeURIComponent(code)}`, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(await readErrorMessage(response));

          const body = (await response.json()) as { data: WhichMoreRoomDto };
          if (stopped) return;

          const next = whichMorePollSignature(body.data);
          quiet = next === last ? quiet + 1 : 0;
          last = next;

          setFailures(0);
          setRoom(body.data);
        } catch {
          if (stopped) return;
          quiet += 1;
          setFailures((count) => count + 1);
        }
      }
    };

    void loop();

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      controller.abort();
      if (timer !== undefined) clearTimeout(timer);
      wake?.();
    };
  }, [code, phase]);

  const choose = useCallback(
    (chosenId: string): void => {
      const duel = room.currentDuel;
      const index = room.currentRoundIndex;
      if (duel === null || index === null || submitting) return;

      setSubmitting(true);
      setSubmitError(null);

      void (async () => {
        try {
          const response = await fetch(
            `/api/oda/${encodeURIComponent(code)}/cevap`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ roundIndex: index, chosenId }),
            },
          );
          if (!response.ok) throw new Error(await readErrorMessage(response));

          const body = (await response.json()) as {
            data: { correct: boolean; room: WhichMoreRoomDto };
          };

          setRoom(body.data.room);
          setReveal({ duel, chosenId, correct: body.data.correct });
        } catch (error: unknown) {
          setSubmitError(
            error instanceof Error
              ? error.message
              : "Cevap gönderilemedi. Tekrar dene.",
          );
        } finally {
          setSubmitting(false);
        }
      })();
    },
    [room, code, submitting],
  );

  const warn = failures >= FAILURES_BEFORE_WARNING;

  if (room.status === "bekliyor") {
    return <WaitingForJoin room={room} offline={warn} />;
  }

  if (room.status === "suresi-doldu") return <Expired room={room} />;

  // `oynaniyor` ya da `bitti`.
  if (reveal !== null) {
    return (
      <RevealView
        room={room}
        reveal={reveal}
        onContinue={() => {
          setReveal(null);
        }}
      />
    );
  }

  if (room.status === "bitti") return <ResultView room={room} />;

  if (room.currentDuel === null)
    return <WaitingForOpponent room={room} offline={warn} />;

  return (
    <PlayView
      room={room}
      offline={warn}
      submitting={submitting}
      submitError={submitError}
      onChoose={choose}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Ortak: başlık + skor                                                */
/* ------------------------------------------------------------------ */

const SUBMODE_LABEL: Readonly<Record<WhichMoreRoomDto["submode"], string>> = {
  "ani-olum": "Ani ölüm",
  "sabit-n": "Sabit düello",
};

/** Bu turdaki skorum — moda göre seri ya da doğru sayısı. */
function myScore(room: WhichMoreRoomDto): number {
  return room.submode === "ani-olum" ? room.me.streak : room.me.correct;
}

const OUTCOME_TITLE: Readonly<Record<WhichMoreRoomDto["outcome"], string>> = {
  devam: "Düello Odası",
  yarim: "Maç yarım kaldı",
  beraberlik: "Berabere",
  kazandin: "Kazandın",
  kaybettin: "Kaybettin",
};

/** Sorunun yön cümlesi — "daha çok resmî maça çıktı" gibi. */
function promptFor(room: WhichMoreRoomDto): string {
  const question = questionFor(room.statKey);
  return room.direction === "more" ? question.more : question.less;
}

/* ------------------------------------------------------------------ */
/* Bekleme (arkadaş katılmadı)                                         */
/* ------------------------------------------------------------------ */

function WaitingForJoin({
  room,
  offline,
}: {
  readonly room: WhichMoreRoomDto;
  readonly offline: boolean;
}) {
  const remaining = useRemainingMinutes(room.expiresAt);
  const question = questionFor(room.statKey);
  const level = levelFor(room.level);

  return (
    <div className="flex flex-col gap-6">
      <ModeHeader
        eyebrow="ODA · HANGİSİ DAHA"
        title="Arkadaşını bekliyorsun"
        task={
          <>
            Aşağıdaki kodu arkadaşına gönder. O katıldığı an{" "}
            <strong className="font-semibold text-foreground">
              ikinize aynı düellolar
            </strong>{" "}
            açılır ve maç ikiniz için birden başlar.
          </>
        }
        scoreboard={
          <Scoreboard
            label="Oda durumu"
            cells={[
              {
                label: "Kalan süre",
                value: remaining === null ? "—" : `${String(remaining)} dk`,
                small: true,
              },
            ]}
          />
        }
      />

      <RoomCodeCard code={room.code} />

      <p className="rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-sm text-muted">
        Ayarlar:{" "}
        <strong className="text-foreground">
          {SUBMODE_LABEL[room.submode]}
          {room.submode === "sabit-n" && room.n !== null
            ? ` · ${String(room.n)} düello`
            : ""}{" "}
          · {question.name} · {level.name}
        </strong>
        . Düellolar iki tarafta da aynı; kimse ötekinden farklı futbolcu görmez.
      </p>

      <ConnectionNote offline={offline} />

      <p className="text-sm text-muted">
        Otuz dakika içinde kimse katılmazsa oda kendiliğinden kapanır.{" "}
        <Link
          href="/hangisi-daha"
          className="font-semibold text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Beklerken tek başına oyna
        </Link>
        .
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Oynanıyor                                                           */
/* ------------------------------------------------------------------ */

function PlayView({
  room,
  offline,
  submitting,
  submitError,
  onChoose,
}: {
  readonly room: WhichMoreRoomDto;
  readonly offline: boolean;
  readonly submitting: boolean;
  readonly submitError: string | null;
  onChoose(chosenId: string): void;
}) {
  const duel = room.currentDuel;
  const remaining = useRemainingMinutes(room.expiresAt);

  // `oynaniyor` + `currentDuel` bu dala girmenin koşulu; yine de tipi daraltıyoruz.
  if (duel === null) return null;

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite">
        <ModeHeader
          eyebrow={`ODA · ${room.code}`}
          title={OUTCOME_TITLE[room.outcome]}
          task={
            <>
              Hangisi{" "}
              <strong className="font-semibold text-foreground">
                {promptFor(room)}
              </strong>
              ? Doğru bildikçe seri uzuyor; rakibinin serisi maç bitene kadar
              gizli.
            </>
          }
          scoreboard={<MatchScore room={room} remaining={remaining} />}
        />
      </div>

      <OpponentStrip room={room} />

      <ConnectionNote offline={offline} />

      <ul className="relative grid gap-3 sm:grid-cols-2 sm:gap-4">
        <li>
          <DuelCard
            player={duel.left}
            disabled={submitting}
            onChoose={() => {
              onChoose(duel.left.id);
            }}
          />
        </li>
        <li>
          <DuelCard
            player={duel.right}
            disabled={submitting}
            onChoose={() => {
              onChoose(duel.right.id);
            }}
          />
        </li>
      </ul>

      <p className="text-center text-xs tracking-wide text-muted uppercase">
        {questionFor(room.statKey).name} · {levelFor(room.level).name} ·{" "}
        {SUBMODE_LABEL[room.submode]}
      </p>

      {submitError !== null && (
        <p
          role="alert"
          className="rounded-xl border border-wrong bg-wrong-soft px-4 py-3 text-sm text-wrong"
        >
          {submitError}
        </p>
      )}
    </div>
  );
}

/**
 * Bir düello kartı — SAYI TAŞIMAZ (BR-32). Değer hiçbir zaman istemciye
 * gelmiyor; kart yalnızca ad ve tanıtım kulüplerini gösteriyor, seçim sonucu
 * (kim kazandı) cevaptan sonra açılıyor.
 */
function DuelCard({
  player,
  disabled,
  onChoose,
}: {
  readonly player: WhichMorePairDto["left"];
  readonly disabled: boolean;
  onChoose(): void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChoose}
      className="flex w-full flex-col items-start gap-2 rounded-2xl border-2 border-line-strong bg-surface px-4 py-4 text-left shadow-card transition-[transform,box-shadow,border-color,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent enabled:hover:-translate-y-0.5 enabled:hover:border-accent enabled:hover:bg-accent-soft enabled:hover:shadow-pop enabled:active:translate-y-0 disabled:opacity-70"
    >
      <span className="font-display text-lg leading-tight font-bold tracking-tight">
        {player.name}
      </span>
      <span className="text-sm text-muted">{player.clubs.join(" · ")}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Cevap sonrası açılış                                                */
/* ------------------------------------------------------------------ */

/**
 * Cevaptan sonra düellonun açığa çıkmış hâli.
 *
 * DEĞER YOK, SONUÇ VAR (BR-32). Sunucu değeri göndermiyor; ama "doğru mu" ile
 * "hangisini seçtim" birleşince kazananı TÜRETEBİLİYORUZ: doğruysa seçtiğim,
 * yanlışsa öteki kazanandır. Böylece değer sızdırmadan sonucu gösteriyoruz.
 */
function RevealView({
  room,
  reveal,
  onContinue,
}: {
  readonly room: WhichMoreRoomDto;
  readonly reveal: Reveal;
  onContinue(): void;
}) {
  const winnerId = reveal.correct
    ? reveal.chosenId
    : reveal.duel.left.id === reveal.chosenId
      ? reveal.duel.right.id
      : reveal.duel.left.id;

  const finished = room.status === "bitti" || room.status === "suresi-doldu";
  const canContinue = !finished && room.currentDuel !== null;

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite">
        <ModeHeader
          eyebrow={`ODA · ${room.code}`}
          title={reveal.correct ? "Doğru" : "Yanlış"}
          task={
            reveal.correct ? (
              <>
                Doğru bildin — seri{" "}
                <strong className="font-semibold text-foreground">
                  {String(myScore(room))}
                </strong>
                .
              </>
            ) : (
              <>
                Bu sefer olmadı. Doğru cevap işaretlendi.
                {room.submode === "ani-olum"
                  ? " Ani ölümde koşu burada bitti."
                  : ""}
              </>
            )
          }
          scoreboard={<MatchScore room={room} remaining={null} />}
        />
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {[reveal.duel.left, reveal.duel.right].map((player) => {
          const isWinner = player.id === winnerId;
          const isChosen = player.id === reveal.chosenId;
          return (
            <li key={player.id}>
              <div
                className={
                  "flex w-full flex-col items-start gap-2 rounded-2xl border-2 px-4 py-4 " +
                  (isWinner
                    ? "border-correct bg-correct-soft shadow-card"
                    : "border-line-strong bg-surface")
                }
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="font-display text-lg leading-tight font-bold tracking-tight">
                    {player.name}
                  </span>
                  {isWinner && (
                    <span className="shrink-0 rounded-full border border-correct px-2 py-0.5 text-[0.65rem] font-extrabold tracking-[0.13em] text-correct uppercase">
                      kazanan
                    </span>
                  )}
                </span>
                <span className="text-sm text-muted">
                  {player.clubs.join(" · ")}
                </span>
                {isChosen && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-fg">
                    senin seçimin
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {canContinue ? (
        <Button size="md" className="w-fit" onClick={onContinue}>
          Sonraki düello
        </Button>
      ) : (
        <Button size="md" className="w-fit" onClick={onContinue}>
          {finished ? "Sonucu gör" : "Devam"}
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kendi koşum bitti, rakibi bekliyorum                                */
/* ------------------------------------------------------------------ */

function WaitingForOpponent({
  room,
  offline,
}: {
  readonly room: WhichMoreRoomDto;
  readonly offline: boolean;
}) {
  const remaining = useRemainingMinutes(room.expiresAt);

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite">
        <ModeHeader
          eyebrow={`ODA · ${room.code}`}
          title="Rakibini bekliyorsun"
          task={
            room.submode === "ani-olum"
              ? "Koşun bitti. Rakibin de bitince maç sonucu açılır."
              : "Tüm düelloları cevapladın. Rakibin de bitince sonuç açılır."
          }
          scoreboard={<MatchScore room={room} remaining={remaining} />}
        />
      </div>

      <OpponentStrip room={room} />
      <ConnectionNote offline={offline} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sonuç (karşılaştırma)                                               */
/* ------------------------------------------------------------------ */

function ResultView({ room }: { readonly room: WhichMoreRoomDto }) {
  const opponent = room.opponent;

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite">
        <ModeHeader
          eyebrow={`ODA · ${room.code}`}
          title={OUTCOME_TITLE[room.outcome]}
          task={
            <>
              Maç bitti. Aynı düellolarda ikinizin ne seçtiği aşağıda yan yana
              duruyor.
            </>
          }
          scoreboard={<MatchScore room={room} remaining={null} lit />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PickColumn
          title="Sen"
          picks={room.me.picks}
          highlight={room.outcome === "kazandin"}
        />
        <PickColumn
          title={opponent?.displayName ?? "Rakip"}
          picks={opponent?.picks ?? null}
          highlight={room.outcome === "kaybettin"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/oda"
          className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Yeni oda kur
        </Link>
        <Link
          href="/hangisi-daha"
          className="rounded-lg border border-line px-4 py-3 text-sm font-semibold hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Tek başına oyna
        </Link>
      </div>
    </div>
  );
}

/** Bir oyuncunun tur tur seçimleri — sonuç ekranının yarısı (BR-70). */
function PickColumn({
  title,
  picks,
  highlight,
}: {
  readonly title: string;
  readonly picks: readonly WhichMoreRevealedPick[] | null;
  readonly highlight: boolean;
}) {
  return (
    <section
      className={
        "flex flex-col gap-2 rounded-2xl border p-4 " +
        (highlight
          ? "border-correct bg-correct-soft"
          : "border-line bg-surface")
      }
    >
      <DataLabel as="h2" className="text-muted">
        {title}
      </DataLabel>
      {picks === null || picks.length === 0 ? (
        <p className="text-sm text-muted">Seçim yok.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {picks.map((pick) => (
            <li
              key={pick.roundIndex}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="truncate">
                <span className="text-muted tabular-nums">
                  {String(pick.roundIndex + 1)}.
                </span>{" "}
                {pick.chosenName}
              </span>
              <span
                aria-label={pick.correct ? "doğru" : "yanlış"}
                className={
                  "shrink-0 font-bold " +
                  (pick.correct ? "text-correct" : "text-wrong")
                }
              >
                {pick.correct ? "✓" : "✗"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Süresi doldu                                                        */
/* ------------------------------------------------------------------ */

function Expired({ room }: { readonly room: WhichMoreRoomDto }) {
  return (
    <div className="flex flex-col gap-6">
      <ModeHeader
        eyebrow={`ODA · ${room.code}`}
        title="Süre doldu"
        task="Bu maçın süresi doldu. Yarım kalan maçın galibi yoktur."
      />

      <p className="rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-sm text-muted">
        İkiniz de bitirmediğiniz için sonuç sayılmadı — bitiren tarafı hükmen
        galip saymıyoruz.
      </p>

      <Link
        href="/oda"
        className="w-fit rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Yeni oda kur
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skor tablosu + rakip şeridi                                         */
/* ------------------------------------------------------------------ */

function MatchScore({
  room,
  remaining,
  lit = false,
}: {
  readonly room: WhichMoreRoomDto;
  readonly remaining: number | null;
  readonly lit?: boolean;
}) {
  const scoreWord = room.submode === "ani-olum" ? "Seri" : "Doğru";
  const finished = room.status === "bitti" || room.status === "suresi-doldu";

  // BR-70 — rakip skoru YALNIZCA maç bitince (opponent.streak/correct açılır).
  const opponentScore = finished
    ? room.submode === "ani-olum"
      ? room.opponent?.streak
      : room.opponent?.correct
    : null;

  return (
    <Scoreboard
      label={`${scoreWord} durumu`}
      lit={lit}
      cells={[
        {
          label: "Sen",
          value: String(myScore(room)),
          tone: room.outcome === "kazandin" ? "correct" : "accent",
        },
        {
          label: room.opponent?.displayName ?? "Rakip",
          value:
            opponentScore === null || opponentScore === undefined
              ? "—"
              : String(opponentScore),
          tone: room.outcome === "kaybettin" ? "correct" : undefined,
        },
        ...(finished
          ? []
          : [
              {
                label: "Kalan",
                value: remaining === null ? "—" : `${String(remaining)} dk`,
                small: true,
              },
            ]),
      ]}
    />
  );
}

/**
 * Rakibin gizli ilerleme şeridi — BR-70.
 *
 * Ani ölümde SAYI seriyi ele verir; yalnızca "oynuyor / elendi" gösterilir.
 * Sabit N'de ilerleme (n/N) gösterilir ama doğru sayısı gizli. Maç bitince bu
 * şerit görünmez — sonuç ekranı zaten her şeyi açar.
 */
function OpponentStrip({ room }: { readonly room: WhichMoreRoomDto }) {
  const opponent = room.opponent;
  if (opponent === null) return null;

  return (
    <p
      aria-live="polite"
      className="rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-sm text-muted"
    >
      <strong className="text-foreground">{opponent.displayName}</strong>{" "}
      {opponentStatus(room, opponent)} Serisi ve seçimleri maç bitince açılır.
    </p>
  );
}

function opponentStatus(
  room: WhichMoreRoomDto,
  opponent: WhichMoreOpponentDto,
): string {
  if (room.submode === "ani-olum") {
    return opponent.eliminated ? "koşusunu bitirdi (elendi)." : "hâlâ oynuyor.";
  }
  // Sabit N — ilerleme görünür.
  const n = room.n ?? 0;
  const answered = opponent.answered ?? 0;
  return answered >= n
    ? "tüm düellolarını bitirdi."
    : `${String(answered)}/${String(n)} düello oynadı.`;
}
