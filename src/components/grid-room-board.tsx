"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerDto } from "@/application/dto/player-dto";
import type {
  GridCellDto,
  GridRoomDto,
} from "@/application/use-cases/grid-rooms";
import type { CellRef } from "@/domain/services/grid";
import { gridPollPhase, gridPollSignature } from "@/lib/grid-room-polling";
import { readErrorMessage } from "@/lib/http/error-message";
import { pollDelay } from "@/lib/room-polling";
import { DataLabel } from "./data-label";
import { CriterionIcon, MatrixIcon } from "./grid-icons";
import { ModeHeader, Scoreboard } from "./mode-header";
import { PlayerPicker } from "./player-picker";
import {
  ConnectionNote,
  RoomCodeCard,
  useRemainingMinutes,
} from "./room-board";

/**
 * Izgara (XOX) odası ekranı — PROJECT.md §12.9.
 *
 * Diğer oda tahtalarının (`room-board.tsx`, `which-more-room-board.tsx`) kardeşi:
 * aynı yoklama motoru, aynı kod kartı ve süre sayacı ORADAN paylaşılıyor.
 * Solo ızgaranın tablo düzeni (satır/sütun ölçütleri, hücreye kenetli
 * `PlayerPicker`) da yeniden kullanılıyor. Değişen: oyun SIRA TABANLI (BR-72),
 * tahta HERKESE AÇIK (BR-70 gizlemesi yok), hücreye X/O ya da "ölü" düşüyor.
 */

const FAILURES_BEFORE_WARNING = 2;

/** Başlık sütununun genişliği — Tailwind adı kaynakta taranır, tam ad şart. */
const HEADER_WIDTH = "w-1/4";

const OUTCOME_TITLE: Readonly<Record<GridRoomDto["outcome"], string>> = {
  devam: "Izgara Düello",
  yarim: "Maç yarım kaldı",
  beraberlik: "Berabere",
  kazandin: "Kazandın",
  kaybettin: "Kaybettin",
};

export interface GridRoomBoardProps {
  readonly initialRoom: GridRoomDto;
}

export function GridRoomBoard({ initialRoom }: GridRoomBoardProps) {
  const [room, setRoom] = useState(initialRoom);
  const [failures, setFailures] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [openCell, setOpenCell] = useState<CellRef | null>(null);

  const code = room.code;
  const phase = gridPollPhase(room);

  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

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

  // Yoklama döngüsü — diğer oda tahtalarıyla birebir aynı desen (§12.1).
  useEffect(() => {
    if (phase === null) return;

    let stopped = false;
    let quiet = 0;
    let last = gridPollSignature(roomRef.current);
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

          const body = (await response.json()) as { data: GridRoomDto };
          if (stopped) return;

          const next = gridPollSignature(body.data);
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

  const submitMove = useCallback(
    (cell: CellRef, player: PlayerDto): void => {
      if (submitting) return;
      setSubmitting(true);
      setSubmitError(null);
      setOpenCell(null);

      void (async () => {
        try {
          const response = await fetch(
            `/api/oda/${encodeURIComponent(code)}/cevap`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                row: cell.row,
                column: cell.column,
                playerId: player.id,
              }),
            },
          );
          if (!response.ok) throw new Error(await readErrorMessage(response));

          const body = (await response.json()) as {
            data: { correct: boolean; room: GridRoomDto };
          };
          setRoom(body.data.room);
        } catch (error: unknown) {
          setSubmitError(
            error instanceof Error
              ? error.message
              : "Hamle gönderilemedi. Tekrar dene.",
          );
        } finally {
          setSubmitting(false);
        }
      })();
    },
    [code, submitting],
  );

  const warn = failures >= FAILURES_BEFORE_WARNING;

  if (room.status === "bekliyor") {
    return <WaitingForJoin room={room} offline={warn} />;
  }
  if (room.status === "suresi-doldu") return <Expired room={room} />;
  if (room.status === "bitti") return <ResultView room={room} />;

  return (
    <PlayView
      room={room}
      offline={warn}
      submitting={submitting}
      submitError={submitError}
      openCell={openCell}
      searchPlayers={searchPlayers}
      onOpenCell={setOpenCell}
      onSelect={submitMove}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Skor — tahtadan sayılır                                             */
/* ------------------------------------------------------------------ */

/** Kapatılan hücrelerden benim ve rakibin sayısı — tahtadan türetilir. */
function countMarks(room: GridRoomDto): {
  readonly mine: number;
  readonly theirs: number;
} {
  let mine = 0;
  let theirs = 0;
  for (const cell of room.board.flat()) {
    if (cell.kind !== "kapali") continue;
    if (cell.mark === room.me.mark) mine += 1;
    else theirs += 1;
  }
  return { mine, theirs };
}

function MatchScore({
  room,
  remaining,
  lit = false,
}: {
  readonly room: GridRoomDto;
  readonly remaining: number | null;
  readonly lit?: boolean;
}) {
  const { mine, theirs } = countMarks(room);
  const finished = room.status === "bitti" || room.status === "suresi-doldu";

  return (
    <Scoreboard
      label="Hücre durumu"
      lit={lit}
      cells={[
        {
          label: `Sen (${room.me.mark})`,
          value: String(mine),
          tone: room.outcome === "kazandin" ? "correct" : "accent",
        },
        {
          label: `${room.opponent?.displayName ?? "Rakip"}${
            room.opponent ? ` (${room.opponent.mark})` : ""
          }`,
          value: String(theirs),
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

/* ------------------------------------------------------------------ */
/* Bekleme (arkadaş katılmadı)                                         */
/* ------------------------------------------------------------------ */

function WaitingForJoin({
  room,
  offline,
}: {
  readonly room: GridRoomDto;
  readonly offline: boolean;
}) {
  const remaining = useRemainingMinutes(room.expiresAt);

  return (
    <div className="flex flex-col gap-6">
      <ModeHeader
        eyebrow="ODA · IZGARA"
        title="Arkadaşını bekliyorsun"
        task={
          <>
            Aşağıdaki kodu arkadaşına gönder. O katıldığı an{" "}
            <strong className="font-semibold text-foreground">
              ikinize aynı ızgara
            </strong>{" "}
            açılır ve sırayla oynamaya başlarsınız.
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
        Kurallar:{" "}
        <strong className="text-foreground">
          Sıra sende (X/O), doğru cevap hücreyi kapar, yanlış cevap hücreyi
          harcar
        </strong>
        . Üç taşı yan yana dizen ya da tahta dolunca çok hücre kapan kazanır;
        eşitlik beraberlik.
      </p>

      <ConnectionNote offline={offline} />

      <p className="text-sm text-muted">
        Otuz dakika içinde kimse katılmazsa oda kendiliğinden kapanır.{" "}
        <Link
          href="/izgara"
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
  openCell,
  searchPlayers,
  onOpenCell,
  onSelect,
}: {
  readonly room: GridRoomDto;
  readonly offline: boolean;
  readonly submitting: boolean;
  readonly submitError: string | null;
  readonly openCell: CellRef | null;
  searchPlayers(term: string, signal: AbortSignal): Promise<PlayerDto[]>;
  onOpenCell(cell: CellRef | null): void;
  onSelect(cell: CellRef, player: PlayerDto): void;
}) {
  const remaining = useRemainingMinutes(room.expiresAt);
  const yourTurn = room.yourTurn;

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite">
        <ModeHeader
          eyebrow={`ODA · ${room.code}`}
          title={yourTurn ? "Sıra sende" : "Rakip oynuyor"}
          task={
            yourTurn ? (
              <>
                Bir hücre seç ve o hücrenin{" "}
                <strong className="font-semibold text-foreground">
                  satır ve sütun ölçütünü birden
                </strong>{" "}
                sağlayan bir futbolcu bul. Yanlış cevap hücreyi harcar.
              </>
            ) : (
              <>
                <strong className="font-semibold text-foreground">
                  {room.opponent?.displayName ?? "Rakip"}
                </strong>{" "}
                hamlesini yapıyor. Tahta ikinize de açık; hamlesi belirince sıra
                sana geçer.
              </>
            )
          }
          scoreboard={<MatchScore room={room} remaining={remaining} />}
        />
      </div>

      {/* SIRA GÖSTERGESİ — renk tek gösterge değil (WCAG 1.4.1): metin yazılı. */}
      <p
        aria-live="polite"
        className={
          "rounded-xl border px-4 py-3 text-sm font-semibold " +
          (yourTurn
            ? "border-accent bg-accent-soft text-foreground"
            : "border-line bg-surface-2/40 text-muted")
        }
      >
        {yourTurn
          ? "Sıra sende — boş bir hücreye dokun."
          : `${room.opponent?.displayName ?? "Rakip"} oynuyor — bekle.`}
      </p>

      <ConnectionNote offline={offline} />

      <GridTable
        room={room}
        interactive={yourTurn && !submitting}
        openCell={openCell}
        searchPlayers={searchPlayers}
        onOpenCell={onOpenCell}
        onSelect={onSelect}
      />

      {submitting && (
        <p className="text-sm text-muted" aria-live="polite">
          Hamle gönderiliyor…
        </p>
      )}

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

/* ------------------------------------------------------------------ */
/* Sonuç                                                               */
/* ------------------------------------------------------------------ */

function ResultView({ room }: { readonly room: GridRoomDto }) {
  return (
    <div className="flex flex-col gap-6">
      <div aria-live="polite">
        <ModeHeader
          eyebrow={`ODA · ${room.code}`}
          title={OUTCOME_TITLE[room.outcome]}
          task={
            room.outcome === "beraberlik" ? (
              <>Maç bitti — berabere. Tahta aşağıda.</>
            ) : (
              <>
                Maç bitti. Kim hangi hücreyi kaptığı aşağıdaki tahtada yan yana
                duruyor.
              </>
            )
          }
          scoreboard={<MatchScore room={room} remaining={null} lit />}
        />
      </div>

      {/* Biten maçın tahtası — salt okunur (interactive false). */}
      <GridTable
        room={room}
        interactive={false}
        openCell={null}
        searchPlayers={() => Promise.resolve([])}
        onOpenCell={() => {
          /* salt okunur */
        }}
        onSelect={() => {
          /* salt okunur */
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/oda?mod=izgara"
          className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Yeni oda kur
        </Link>
        <Link
          href="/izgara"
          className="rounded-lg border border-line px-4 py-3 text-sm font-semibold hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Tek başına oyna
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Süresi doldu                                                        */
/* ------------------------------------------------------------------ */

function Expired({ room }: { readonly room: GridRoomDto }) {
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
        href="/oda?mod=izgara"
        className="w-fit rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Yeni oda kur
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tahta                                                               */
/* ------------------------------------------------------------------ */

/**
 * Ortak 3×3 tahta — solo ızgaranın (`grid-game.tsx`) tablo düzenini yeniden
 * kullanır. Semantik bir TABLO: hücrenin anlamı satır ve sütun başlığının
 * kesişimidir; `scope`'lu başlıklar sayesinde ekran okuyucu hücreye girince
 * "Barcelona, Brezilya" der.
 */
function GridTable({
  room,
  interactive,
  openCell,
  searchPlayers,
  onOpenCell,
  onSelect,
}: {
  readonly room: GridRoomDto;
  readonly interactive: boolean;
  readonly openCell: CellRef | null;
  searchPlayers(term: string, signal: AbortSignal): Promise<PlayerDto[]>;
  onOpenCell(cell: CellRef | null): void;
  onSelect(cell: CellRef, player: PlayerDto): void;
}) {
  const size = room.rows.length;

  return (
    <div className="relative rounded-2xl border border-line bg-surface p-2 shadow-card sm:p-3">
      <table className="w-full border-separate border-spacing-1.5">
        <caption className="sr-only">
          {`${String(size)}×${String(size)} XOX ızgarası.`} Sütunlar:{" "}
          {room.columns.map((column) => column.label).join(", ")}. Satırlar:{" "}
          {room.rows.map((row) => row.label).join(", ")}.
        </caption>
        <thead>
          <tr>
            <td className="p-0 align-bottom">
              <div
                aria-hidden="true"
                className="flex h-full flex-col items-center justify-center gap-1 rounded-xl bg-background px-2 py-3 text-center"
              >
                <MatrixIcon />
                <span className="font-display leading-none font-bold tracking-tight tabular-nums">
                  {size}×{size}
                </span>
                <DataLabel className="text-muted">matris</DataLabel>
              </div>
            </td>
            {room.columns.map((column, index) => (
              <th
                key={`col-${String(index)}`}
                scope="col"
                className={`${HEADER_WIDTH} p-0 text-sm font-semibold`}
              >
                <CriterionLabel criterion={column} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {room.rows.map((row, rowIndex) => (
            <tr key={`row-${String(rowIndex)}`}>
              <th
                scope="row"
                className={`${HEADER_WIDTH} p-0 text-sm font-semibold`}
              >
                <CriterionLabel criterion={row} />
              </th>
              {room.columns.map((column, columnIndex) => {
                const cell = room.board[rowIndex]?.[columnIndex];
                const ref: CellRef = { row: rowIndex, column: columnIndex };
                const isOpen =
                  openCell?.row === rowIndex && openCell.column === columnIndex;

                return (
                  <td
                    key={`cell-${String(columnIndex)}`}
                    className="p-0 sm:relative"
                  >
                    <GridRoomCell
                      cell={cell ?? { kind: "bos" }}
                      interactive={interactive}
                      isOpen={isOpen}
                      label={`${row.label} ve ${column.label}`}
                      onOpen={() => {
                        onOpenCell(ref);
                      }}
                    />

                    {isOpen && interactive && (
                      <div
                        className={
                          "absolute top-full right-0 left-0 z-20 mt-2 sm:w-80 " +
                          (columnIndex >= size - 1
                            ? "sm:left-auto"
                            : "sm:right-auto")
                        }
                      >
                        <PlayerPicker
                          label={`${row.label} ve ${column.label} için oyuncu seçin`}
                          usedPlayerIds={EMPTY_USED}
                          search={searchPlayers}
                          onSelect={(player) => {
                            onSelect(ref, player);
                          }}
                          onCancel={() => {
                            onOpenCell(null);
                          }}
                        />
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** BR-74 — futbolcu sınırsız tekrar; hiçbir kimlik gizlenmez. */
const EMPTY_USED: ReadonlySet<string> = new Set<string>();

/**
 * Bir hücre. DURUM RENKLE DEĞİL, İŞARETLE anlatılır (WCAG 1.4.1): kapalı hücre
 * büyük X/O taşır, ölü hücre "—"; renk yalnızca destekleyici.
 */
function GridRoomCell({
  cell,
  interactive,
  isOpen,
  label,
  onOpen,
}: {
  readonly cell: GridCellDto;
  readonly interactive: boolean;
  readonly isOpen: boolean;
  readonly label: string;
  onOpen(): void;
}) {
  if (cell.kind === "kapali") {
    return (
      <div
        className={
          "flex h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 text-center sm:h-28 " +
          (cell.mine
            ? "border-accent bg-accent-soft"
            : "border-line-strong bg-surface")
        }
      >
        <span
          aria-hidden="true"
          className={
            "font-display text-2xl leading-none font-black " +
            (cell.mine ? "text-accent" : "text-foreground")
          }
        >
          {cell.mark}
        </span>
        <span className="font-display text-xs leading-tight font-bold tracking-tight text-balance">
          {cell.playerName}
        </span>
        <span className="sr-only">
          {label}: {cell.playerName} — {cell.mark}
          {cell.mine ? " (senin)" : ""}
        </span>
      </div>
    );
  }

  if (cell.kind === "olu") {
    return (
      <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line-strong bg-surface-2 px-2 text-center sm:h-28">
        <span
          aria-hidden="true"
          className="text-xl leading-none font-bold text-muted"
        >
          —
        </span>
        <span className="font-display text-xs leading-tight font-bold tracking-tight text-balance text-muted line-through">
          {cell.playerName}
        </span>
        <span className="sr-only">
          {label}: {cell.playerName} — yanlış, hücre boşa gitti
        </span>
      </div>
    );
  }

  // Boş hücre. Yalnızca sıra bendeyken tıklanabilir; değilse "bekleniyor".
  if (!interactive) {
    return (
      <div className="flex h-24 flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-background/60 text-sm sm:h-28">
        <span
          aria-hidden="true"
          className="text-2xl leading-none text-line-strong"
        >
          ·
        </span>
        <span className="sr-only">{label}: boş</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      className="group flex h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line-strong bg-background text-sm transition-colors hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:h-28"
      onClick={onOpen}
    >
      <span
        aria-hidden="true"
        className="text-2xl leading-none font-light text-muted transition-colors group-hover:text-accent"
      >
        +
      </span>
      <span
        aria-hidden="true"
        className="font-display text-[0.7rem] font-semibold tracking-wide text-muted uppercase transition-colors group-hover:text-accent"
      >
        Futbolcu seç
      </span>
      <span className="sr-only">{label} için oyuncu seçin</span>
    </button>
  );
}

/** Ölçüt etiketi — kulüp/uyruk görsel olarak ayrılır (solo ızgarayla aynı). */
function CriterionLabel({
  criterion,
}: {
  readonly criterion: GridRoomDto["rows"][number];
}) {
  return (
    <span className="flex h-full flex-col items-center justify-center gap-1 rounded-xl bg-background px-2 py-3 text-center">
      <CriterionIcon kind={criterion.kind} />
      <span className="font-display leading-tight font-bold tracking-tight text-balance">
        {criterion.label}
      </span>
      <DataLabel className="text-muted">
        {criterion.kind === "club" ? "kulüp" : "uyruk"}
      </DataLabel>
    </span>
  );
}
