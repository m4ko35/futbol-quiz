"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { PlayerDto } from "@/application/dto/player-dto";
import type {
  DailyGridDto,
  GridCriterionDto,
} from "@/application/use-cases/daily-grid";
import {
  cellKey,
  isGameOver,
  MAX_GUESSES,
  type CellRef,
} from "@/domain/services/grid";
import {
  parseSavedGame,
  readSavedGame,
  readSavedGameOnServer,
  subscribeToSavedGame,
  writeSavedGame,
  type CellState,
  type GameState,
} from "@/lib/grid-storage";
import { PlayerPicker } from "./player-picker";

/**
 * 3×3 ızgara oyunu — PROJECT.md §9.1.
 *
 * BU BİLEŞEN İŞ KURALI UYGULAMAZ. Bir cevabın doğru olup olmadığına sunucu
 * karar verir (BR-12); burada yalnızca oyunun görünen durumu tutulur. Tek
 * istisna BR-10'un (bir oyuncu tek hücrede) listede gizlenmesidir ve o da bir
 * uygulama değil, kesin reddedilecek bir seçimden koruma.
 *
 * BR-10'UN SINIRI AÇIKÇA SÖYLENSİN: kural yalnızca istemcide zorlanıyor.
 * Sunucu, bu ızgarada hangi oyuncuların kullanıldığını BİLMEZ — oturum yok,
 * sunucu tarafı oyun durumu yok. Şu an bu bir açık değil, çünkü kazanılacak
 * bir şey de yok: skor kaydedilmiyor, sıralama yok. §9'daki skor tablosu
 * eklendiğinde oyun durumu sunucuya taşınmak ZORUNDA (§10.2).
 *
 * OYUN DURUMU REACT STATE'İNDE DEĞİL, DEPODA. Tek bir kaynak var ve o da
 * `@/lib/grid-storage`; bileşen onu `useSyncExternalStore` ile okur. İki kopya
 * tutulsaydı (hem `useState` hem depo) ikisinin ayrışması an meselesiydi.
 */

export interface GridGameProps {
  readonly grid: DailyGridDto;
  /** Cevap doğrulama; testlerde sahte bir uygulama verilir. */
  checkAnswer(cell: CellRef, playerId: string): Promise<boolean>;
  /** Oyuncu arama; testlerde sahte bir uygulama verilir. */
  searchPlayers(term: string, signal: AbortSignal): Promise<PlayerDto[]>;
}

function emptyGame(date: string): GameState {
  return { date, cells: {}, guessesUsed: 0 };
}

export function GridGame({ grid, checkAnswer, searchPlayers }: GridGameProps) {
  const raw = useSyncExternalStore(
    subscribeToSavedGame,
    readSavedGame,
    readSavedGameOnServer,
  );

  const state = useMemo(
    () => parseSavedGame(raw, grid.date) ?? emptyGame(grid.date),
    [raw, grid.date],
  );

  const [openCell, setOpenCell] = useState<CellRef | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const answers = Object.values(state.cells);
  const solvedCells = answers.filter(
    (cell) => cell.status === "correct",
  ).length;
  const finished = isGameOver(state.guessesUsed, answers.length);
  const remaining = MAX_GUESSES - state.guessesUsed;
  const usedPlayerIds = new Set(answers.map((cell) => cell.playerId));

  const submit = useCallback(
    async (cell: CellRef, player: PlayerDto): Promise<void> => {
      setOpenCell(null);
      setIsChecking(true);
      setFailure(null);

      try {
        const correct = await checkAnswer(cell, player.id);

        // Güncel durum YAZMA ANINDA depodan okunur; bekleyen isteğin başladığı
        // andaki kopyanın üzerine yazmak, arada tamamlanan bir cevabı silerdi.
        const current =
          parseSavedGame(readSavedGame(), grid.date) ?? emptyGame(grid.date);

        writeSavedGame({
          date: current.date,
          cells: {
            ...current.cells,
            [cellKey(cell)]: {
              status: correct ? "correct" : "wrong",
              playerId: player.id,
              playerName: player.name,
            },
          },
          guessesUsed: current.guessesUsed + 1,
        });
      } catch {
        // Doğrulanamayan bir cevap HAK HARCAMAZ. Ağ hatası yüzünden hücre
        // kaybetmek, kullanıcının yapmadığı bir hatanın cezası olurdu.
        setFailure("Cevap doğrulanamadı. Lütfen tekrar deneyin.");
      } finally {
        setIsChecking(false);
      }
    },
    [checkAnswer, grid.date],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="max-w-prose text-sm text-muted">
          Her hücreye, satır ve sütun ölçütlerinin{" "}
          <strong className="font-semibold text-foreground">
            ikisini birden
          </strong>{" "}
          sağlayan bir oyuncu yazın.
        </p>
        {/* Sayaçlar ekran okuyucuya da bildirilir; sayıların değişmesi
            yalnızca görsel bir olay olamaz. */}
        <p
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold tabular-nums shadow-card"
          aria-live="polite"
        >
          {String(solvedCells)}/{String(MAX_GUESSES)} doğru ·{" "}
          {String(remaining)} hak kaldı
        </p>
      </div>

      {/*
        NEDEN GERÇEK BİR TABLO. Izgara semantik olarak bir tablodur: bir hücrenin
        anlamı satır ve sütun başlığının KESİŞİMİDİR. `scope` ile işaretlenmiş
        başlıklar sayesinde ekran okuyucu hücreye girildiğinde "Barcelona,
        Brezilya" diye okur; `div`'lerden kurulmuş bir ızgarada bu bağ kurulamaz
        ve kullanıcı hangi soruyu cevapladığını bilemezdi.
      */}
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface p-2 shadow-card sm:p-3">
        <table className="w-full border-separate border-spacing-1.5">
          <caption className="sr-only">
            {grid.date} tarihli 3×3 ızgara. Sütunlar:{" "}
            {grid.columns.map((column) => column.label).join(", ")}. Satırlar:{" "}
            {grid.rows.map((row) => row.label).join(", ")}.
          </caption>
          <thead>
            <tr>
              {/* Sol üst köşe boş; bir başlık değil. */}
              <td />
              {grid.columns.map((column, index) => (
                <th
                  key={`col-${String(index)}`}
                  scope="col"
                  className="w-1/4 p-0 text-sm font-semibold"
                >
                  <CriterionLabel criterion={column} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row, rowIndex) => (
              <tr key={`row-${String(rowIndex)}`}>
                <th scope="row" className="w-1/4 p-0 text-sm font-semibold">
                  <CriterionLabel criterion={row} />
                </th>
                {grid.columns.map((column, columnIndex) => {
                  const cell: CellRef = { row: rowIndex, column: columnIndex };
                  const answer = state.cells[cellKey(cell)];
                  const isOpen =
                    openCell?.row === rowIndex &&
                    openCell.column === columnIndex;

                  return (
                    <td key={`cell-${String(columnIndex)}`} className="p-0">
                      <Cell
                        answer={answer}
                        isOpen={isOpen}
                        disabled={
                          finished || isChecking || answer !== undefined
                        }
                        label={`${row.label} ve ${column.label}`}
                        onOpen={() => {
                          setOpenCell(cell);
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isChecking && (
        <p className="text-sm text-muted" aria-live="polite">
          Cevap kontrol ediliyor…
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

      {openCell !== null && !finished && (
        <PlayerPicker
          label={`${grid.rows[openCell.row]?.label ?? ""} ve ${
            grid.columns[openCell.column]?.label ?? ""
          } için oyuncu seçin`}
          usedPlayerIds={usedPlayerIds}
          search={searchPlayers}
          onSelect={(player) => {
            void submit(openCell, player);
          }}
          onCancel={() => {
            setOpenCell(null);
          }}
        />
      )}

      {finished && (
        <p
          className="rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm"
          role="status"
        >
          Oyun bitti —{" "}
          <strong>
            {String(solvedCells)}/{String(MAX_GUESSES)}
          </strong>
          . Yeni ızgara her gün 03.00&apos;te (TSİ) yayınlanır.
        </p>
      )}
    </div>
  );
}

/**
 * Ölçüt etiketi. Kulüp ve uyruk GÖRSEL OLARAK AYRILIR.
 *
 * Ayrım olmasaydı "Monaco" satırının ülkeyi mi kulübü mü sorduğu belirsiz
 * kalırdı — ve bu belirsizlik oyunu doğrudan bozar.
 */
function CriterionLabel({
  criterion,
}: {
  readonly criterion: GridCriterionDto;
}) {
  return (
    <span className="flex h-full flex-col items-center justify-center gap-0.5 rounded-xl bg-background px-2 py-3 text-center">
      <span className="leading-tight text-balance">{criterion.label}</span>
      <span className="text-[0.7rem] font-medium tracking-wide text-muted uppercase">
        {criterion.kind === "club" ? "kulüp" : "uyruk"}
      </span>
    </span>
  );
}

interface CellProps {
  readonly answer: CellState | undefined;
  readonly isOpen: boolean;
  readonly disabled: boolean;
  readonly label: string;
  onOpen(): void;
}

/**
 * Bir hücre.
 *
 * DURUM RENKLE DEĞİL, METİNLE ANLATILIR (WCAG 1.4.1). Doğru ve yanlış hücreler
 * "✓"/"✗" işareti ve ekran okuyucuya giden sözcükle ayrılır; renk yalnızca
 * destekleyicidir. Renk körü bir kullanıcı ya da tek renkli bir ekran, oyunun
 * durumunu yine de okuyabilir.
 */
function Cell({ answer, isOpen, disabled, label, onOpen }: CellProps) {
  if (answer !== undefined) {
    const isCorrect = answer.status === "correct";
    return (
      <div
        className={`flex h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 text-center text-sm sm:h-28 ${
          isCorrect
            ? "border-correct bg-correct-soft"
            : "border-wrong bg-wrong-soft"
        }`}
      >
        <span
          aria-hidden="true"
          className={`text-lg leading-none font-bold ${
            isCorrect ? "text-correct" : "text-wrong"
          }`}
        >
          {isCorrect ? "✓" : "✗"}
        </span>
        <span className="leading-tight font-medium text-balance">
          {answer.playerName}
        </span>
        <span className="sr-only">
          {label}: {answer.playerName} — {isCorrect ? "doğru" : "yanlış"}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-expanded={isOpen}
      className="group flex h-24 w-full items-center justify-center rounded-xl border-2 border-dashed border-line-strong bg-background text-sm transition-colors hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:bg-background sm:h-28"
      onClick={onOpen}
    >
      <span
        aria-hidden="true"
        className="text-2xl leading-none font-light text-muted transition-colors group-hover:text-accent"
      >
        +
      </span>
      <span className="sr-only">{label} için oyuncu seçin</span>
    </button>
  );
}
