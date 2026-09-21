"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { PlayerDto } from "@/application/dto/player-dto";
import type {
  GridCriterionDto,
  GridRoundDto,
  RevealedCellDto,
} from "@/application/use-cases/daily-grid";
import {
  cellKey,
  isGameOver,
  maxGuesses,
  type CellRef,
} from "@/domain/services/grid";
import { PUZZLE_ROLLOVER_HOUR } from "@/domain/value-objects/daily-seed";
import {
  parseSavedGame,
  readSavedGame,
  readSavedGameOnServer,
  subscribeToSavedGame,
  writeSavedGame,
  type CellState,
  type GameState,
} from "@/lib/grid-storage";
import { formatTurkishIsoDate } from "@/lib/format-date";
import { DataLabel } from "./data-label";
import { ModeHeader, Scoreboard } from "./mode-header";
import { PlayerPicker } from "./player-picker";
import { Button } from "./ui/button";

/**
 * Yeni bulmacanın yayın saati — BR-49'un sabitinden TÜRETİLİR.
 *
 * Metne elle yazılmıştı ve sınır 06:00'ya taşındığında geride kaldı (§11.11).
 */
const ROLLOVER_LABEL = `${String(PUZZLE_ROLLOVER_HOUR).padStart(2, "0")}.00`;

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
 * GÜNLÜK IZGARANIN DURUMU REACT STATE'İNDE DEĞİL, DEPODA. Tek bir kaynak var
 * ve o da `@/lib/grid-storage`; bileşen onu `useSyncExternalStore` ile okur.
 * İki kopya tutulsaydı (hem `useState` hem depo) ikisinin ayrışması an
 * meselesiydi.
 *
 * "SEN KUR" IZGARASI SAKLANMAZ (§9.1) ve durumu React state'inde durur. Bu bir
 * istisna değil, aynı kuralın diğer yüzü: saklanan tek şey "bugünün ızgarası"
 * olduğu için, saklanmayan ızgaranın depoda anahtarı da yok. Hangi kaynağın
 * geçerli olduğuna `date` karar verir — iki kaynak aynı anda yazılmaz.
 */

export interface GridGameProps {
  /** Oynanacak ızgara — günün ızgarası ya da kullanıcının kurduğu (BR-25). */
  readonly grid: GridRoundDto;
  /**
   * Varsa ilerleme o güne yazılır; yoksa ızgara SAKLANMAZ.
   *
   * "Sen kur" ızgaraları saklanmaz ve bu bilinçli (§9.1): günlük ilerleme gün
   * anahtarına yazılır çünkü "bugünün ızgarası" tekildir, oysa kullanıcı
   * istediği kadar ızgara kurabilir.
   */
  readonly date?: string;
  /**
   * Verilirse sayfanın mod künyesi buradan basılır ve sayaçlar tabelaya
   * taşınır (§7.15).
   *
   * NEDEN BURADA. Sayaçlar bu bileşenin durumundan geliyor; künyeyi sunucu
   * sayfasında bırakıp sayıyı yukarı taşımak, aynı sayının iki yerde
   * yaşaması demekti. Prop İSTEĞE BAĞLI çünkü "Sen kur" ızgarası aynı
   * bileşeni kullanıyor ve sayfada ikinci bir `h1` OLAMAZ; o tur kendi
   * satır içi sayacını korur.
   */
  readonly header?: { readonly eyebrow?: string; readonly title: string };
  /** Oyun bitince yeni ızgara kurmak için — yalnızca "Sen kur" turunda. */
  onRestart?: () => void;
  /** Cevap doğrulama; testlerde sahte bir uygulama verilir. */
  checkAnswer(cell: CellRef, playerId: string): Promise<boolean>;
  /** Oyuncu arama; testlerde sahte bir uygulama verilir. */
  searchPlayers(term: string, signal: AbortSignal): Promise<PlayerDto[]>;
  /**
   * "Pes et → Cevapları gör" (BR-66): boş hücreler için örnek cevap ister.
   *
   * İSTEĞE BAĞLI — verilmezse "Pes et" düğmesi çıkmaz. `cells` boş hücrelerin
   * sırasıdır; yanıttaki `index` bu sıraya karşılık gelir. `used`, aynı
   * futbolcunun iki hücrede belirmemesi için kullanıcının kendi cevaplarıdır.
   */
  reveal?(cells: CellRef[], used: string[]): Promise<RevealedCellDto[]>;
}

/**
 * Başlık sütununun genişliği.
 *
 * Tailwind sınıf adlarını KAYNAKTA TARAR; `w-1/${n}` gibi kurulmuş bir ad
 * üretilen CSS'e girmez. Bu yüzden tam adlar burada, sabit bir tabloda durur.
 */
const HEADER_WIDTH: Readonly<Record<number, string>> = {
  2: "w-1/3",
  3: "w-1/4",
  4: "w-1/5",
  5: "w-1/6",
};

function emptyGame(date: string): GameState {
  return { date, cells: {}, guessesUsed: 0 };
}

export function GridGame({
  header,
  grid,
  date,
  onRestart,
  checkAnswer,
  searchPlayers,
  reveal,
}: GridGameProps) {
  const raw = useSyncExternalStore(
    subscribeToSavedGame,
    readSavedGame,
    readSavedGameOnServer,
  );

  /**
   * Saklanmayan ızgaranın durumu. İki kaynak da HER RENDER'DA okunur (kancalar
   * koşullu çağrılamaz); hangisinin geçerli olduğuna `date` karar verir.
   */
  const [local, setLocal] = useState<GameState>(() => emptyGame(""));

  const state = useMemo(
    () =>
      date === undefined
        ? local
        : (parseSavedGame(raw, date) ?? emptyGame(date)),
    [raw, date, local],
  );

  const [openCell, setOpenCell] = useState<CellRef | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  /*
   * BOYUT IZGARADAN OKUNUR (BR-27). Ayrı bir prop olarak taşınsaydı iki
   * kaynak olurdu: 5 diyen bir prop ile üç satırlı bir ızgara aynı anda
   * gelebilirdi ve hangisinin doğru olduğu belirsiz kalırdı.
   */
  const size = grid.rows.length;
  const guesses = maxGuesses(size);

  const answers = Object.values(state.cells);
  const solvedCells = answers.filter(
    (cell) => cell.status === "correct",
  ).length;
  const finished = isGameOver(state.guessesUsed, answers.length, size);
  const remaining = guesses - state.guessesUsed;
  const usedPlayerIds = new Set(answers.map((cell) => cell.playerId));

  /**
   * TEMİZLE — ızgarayı sıfırlar (§9.1'de skor/sıralama yok, yani kayıpsız).
   *
   * Yıkıcı olduğu için önce onay istenir. Günlük ızgarada depoya boş durum
   * yazılır; "Sen kur" turunda (date yok) yalnızca yerel durum sıfırlanır —
   * `submit`'teki aynı iki kaynak ayrımı.
   */
  const clear = useCallback(() => {
    if (
      !window.confirm("Izgarayı temizlemek ilerlemenizi silecek. Emin misiniz?")
    ) {
      return;
    }
    setOpenCell(null);
    setFailure(null);
    setShareStatus(null);
    if (date === undefined) setLocal(emptyGame(""));
    else writeSavedGame(emptyGame(date));
  }, [date]);

  /**
   * PES ET → CEVAPLARI GÖR (BR-66).
   *
   * Boş hücreler için sunucudan örnek cevap ister ve oyunu bitirir. Açığa çıkan
   * hücre `revealed` durumunu alır — `correct` DEĞİL: kullanıcı bulmadı,
   * gösterildi (§5.2). Oyunu bitirmek için harcanmayan haklar tüketilmiş sayılır
   * (`guessesUsed = guesses`); "pes etmek = kalan hakları bırakmaktır".
   *
   * `used`, kullanıcının kendi yerleştirdikleridir: aynı futbolcu hem cevapta
   * hem örnekte görünmesin (BR-10 hissi). Sunucu örnekleri birbirinden de ayrı
   * tutar.
   */
  const giveUp = useCallback(async (): Promise<void> => {
    if (reveal === undefined) return;
    if (
      !window.confirm(
        "Pes edilsin mi? Boş hücrelerin örnek cevapları gösterilecek ve oyun bitecek.",
      )
    ) {
      return;
    }

    // Boş hücreler — sıra, yanıttaki `index` ile birebir eşleşir.
    const unsolved: CellRef[] = [];
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (state.cells[cellKey({ row: r, column: c })] === undefined) {
          unsolved.push({ row: r, column: c });
        }
      }
    }
    if (unsolved.length === 0) return;

    const used = Object.values(state.cells).map((cell) => cell.playerId);

    setOpenCell(null);
    setFailure(null);
    setShareStatus(null);
    setIsRevealing(true);

    try {
      const cells = await reveal(unsolved, used);

      const filled: Record<string, CellState> = {};
      for (const one of cells) {
        const target = unsolved[one.index];
        if (target === undefined) continue;
        filled[cellKey(target)] = {
          status: "revealed",
          playerId: one.playerId,
          playerName: one.playerName,
        };
      }

      if (date === undefined) {
        setLocal((current) => ({
          date: "",
          cells: { ...current.cells, ...filled },
          guessesUsed: guesses,
        }));
        return;
      }

      // Güncel durum YAZMA ANINDA depodan okunur — `submit`'teki aynı gerekçe.
      const current = parseSavedGame(readSavedGame(), date) ?? emptyGame(date);
      writeSavedGame({
        date: current.date,
        cells: { ...current.cells, ...filled },
        guessesUsed: guesses,
      });
    } catch {
      setFailure("Cevaplar getirilemedi. Lütfen tekrar deneyin.");
    } finally {
      setIsRevealing(false);
    }
  }, [reveal, size, state, date, guesses]);

  /**
   * Paylaşılacak metin — Wordle tarzı emoji ızgara + skor + bağlantı.
   *
   * NADİRLİK YOK: yalnızca kullanıcının kendi sonucu (doğru/yanlış/boş). Emoji
   * yalnızca PAYLAŞ METNİNDE; arayüzdeki önizleme renkli karelerle çizilir
   * (§7.12: arayüzde emoji ikon kullanılmaz, ama paylaşım metni bir istisna —
   * hedef sosyal/mesaj uygulaması ve kare ızgara oranın kendisidir).
   */
  const buildShareText = useCallback((): string => {
    const rows: string[] = [];
    for (let r = 0; r < size; r += 1) {
      let line = "";
      for (let c = 0; c < size; c += 1) {
        const answer = state.cells[cellKey({ row: r, column: c })];
        line +=
          answer?.status === "correct"
            ? "🟩"
            : answer?.status === "wrong"
              ? "🟥"
              : "⬜";
      }
      rows.push(line);
    }
    const head =
      date === undefined
        ? "Futbol Challenge — 3×3 Izgara"
        : `Futbol Challenge — 3×3 Izgara · ${formatTurkishIsoDate(date)}`;
    const score = `${String(solvedCells)}/${String(size * size)} doğru`;
    const url = `${window.location.origin}/izgara`;
    return [head, score, "", ...rows, "", url].join("\n");
  }, [state, size, date, solvedCells]);

  const share = useCallback(async (): Promise<void> => {
    const text = buildShareText();
    // Mobil paylaşım varsa dene; kullanıcı iptal ederse ya da yoksa panoya kopyala.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        setShareStatus("Paylaşıldı.");
        return;
      } catch {
        // iptal / hata: panoya kopyalamaya düş.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus("Skor panoya kopyalandı.");
    } catch {
      setShareStatus("Paylaşım bu tarayıcıda desteklenmiyor.");
    }
  }, [buildShareText]);

  const submit = useCallback(
    async (cell: CellRef, player: PlayerDto): Promise<void> => {
      setOpenCell(null);
      setIsChecking(true);
      setFailure(null);

      try {
        const correct = await checkAnswer(cell, player.id);
        const answer: CellState = {
          status: correct ? "correct" : "wrong",
          playerId: player.id,
          playerName: player.name,
        };

        if (date === undefined) {
          // Saklanmayan ızgara: güncel durumu React'in kendisi veriyor.
          setLocal((current) => ({
            date: "",
            cells: { ...current.cells, [cellKey(cell)]: answer },
            guessesUsed: current.guessesUsed + 1,
          }));
          return;
        }

        // Güncel durum YAZMA ANINDA depodan okunur; bekleyen isteğin başladığı
        // andaki kopyanın üzerine yazmak, arada tamamlanan bir cevabı silerdi.
        const current =
          parseSavedGame(readSavedGame(), date) ?? emptyGame(date);

        writeSavedGame({
          date: current.date,
          cells: { ...current.cells, [cellKey(cell)]: answer },
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
    [checkAnswer, date],
  );

  const task = (
    <>
      Her hücreye, satır ve sütun ölçütlerinin{" "}
      <strong className="font-semibold text-foreground">ikisini birden</strong>{" "}
      sağlayan bir oyuncu yazın.
    </>
  );

  /*
    SAYAÇLAR EKRAN OKUYUCUYA DA BİLDİRİLİR. Sayıların değişmesi yalnızca görsel
    bir olay olamaz; `aria-live` sarmalayıcı iki dalda da korunuyor.

    "Doğru" hücre sayısı SONUÇ dilinde (`correct`), kalan hak ise azaldıkça
    uyarıya dönüyor: son iki hakta `warn`, hak bittiğinde `wrong`. Renk tek
    gösterge değil — sayı zaten yazılı (WCAG 1.4.1).
  */
  const scoreboard = (
    <Scoreboard
      label="Izgara durumu"
      lit={finished}
      cells={[
        {
          label: "Doğru",
          value: `${String(solvedCells)}/${String(size * size)}`,
          tone: solvedCells > 0 ? "correct" : undefined,
        },
        {
          label: "Hak",
          value: String(remaining),
          tone: remaining === 0 ? "wrong" : remaining <= 2 ? "warn" : undefined,
        },
      ]}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      {header === undefined ? (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <p className="max-w-prose text-sm text-muted">{task}</p>
          <p
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold tabular-nums shadow-card"
            aria-live="polite"
          >
            {String(solvedCells)}/{String(guesses)} doğru · {String(remaining)}{" "}
            hak kaldı
          </p>
        </div>
      ) : (
        <div aria-live="polite">
          <ModeHeader
            eyebrow={header.eyebrow}
            title={header.title}
            task={task}
            scoreboard={scoreboard}
          />
        </div>
      )}

      {/*
        NEDEN GERÇEK BİR TABLO. Izgara semantik olarak bir tablodur: bir hücrenin
        anlamı satır ve sütun başlığının KESİŞİMİDİR. `scope` ile işaretlenmiş
        başlıklar sayesinde ekran okuyucu hücreye girildiğinde "Barcelona,
        Brezilya" diye okur; `div`'lerden kurulmuş bir ızgarada bu bağ kurulamaz
        ve kullanıcı hangi soruyu cevapladığını bilemezdi.
      */}
      {/*
        `overflow-x-auto` KALDIRILDI ve bu bir gerileme değil. Sütun
        genişlikleri yüzde, ölçüt etiketleri sarıyor (`text-balance`); tablo
        yatayda zaten taşmıyordu. Buna karşılık CSS'te bir eksen `visible`
        olmaktan çıkınca diğeri de `auto`ya döner — yani o sınıf DİKEYDE bir
        kırpma bağlamı yaratıyordu ve hücreye kenetlenen seçiciyi kesiyordu.
      */}
      <div className="relative rounded-2xl border border-line bg-surface p-2 shadow-card sm:p-3">
        <table className="w-full border-separate border-spacing-1.5">
          <caption className="sr-only">
            {date === undefined
              ? `Kendi kurduğunuz ${String(size)}×${String(size)} ızgara.`
              : `${date} tarihli ${String(size)}×${String(size)} ızgara.`}{" "}
            Sütunlar: {grid.columns.map((column) => column.label).join(", ")}.
            Satırlar: {grid.rows.map((row) => row.label).join(", ")}.
          </caption>
          <thead>
            <tr>
              {/*
                SOL ÜST KÖŞE ARTIK ÖLÜ ALAN DEĞİL.

                Bir başlık DEĞİL (`td`, `th` değil): satır ya da sütun
                tanımlamıyor, o yüzden `scope` da almıyor.

                Kalan hak burada SAYIYLA DEĞİL İŞARETLERLE duruyor. Sayı zaten
                künye tabelasında yazılı; onu ikinci kez basmak bilgi eklemez.
                İşaret sırası ise sayının vermediğini veriyor: harcanan ve
                kalan hak, bakmadan sayılabilecek bir biçimde. Kendisi süsleme
                olduğu için `aria-hidden` — bilgi tabeladaki sayıda ve
                aşağıdaki metinde zaten var.
              */}
              <td className="p-0 align-bottom">
                <div
                  aria-hidden="true"
                  className="flex flex-col gap-1.5 px-2 pb-2"
                >
                  {/* Tamamlanma çubuğu — çözülen/toplam. Görsel; sayı tabelada
                      ve alttaki metinde zaten yazılı (§7.15). */}
                  <span className="block h-1.5 w-full overflow-hidden rounded-full bg-line">
                    <span
                      className="block h-full rounded-full bg-correct transition-[width] duration-300"
                      style={{
                        width: `${String(Math.round((solvedCells / (size * size)) * 100))}%`,
                      }}
                    />
                  </span>
                  {/* Deneme işaretleri — harcanan haklar dolu. */}
                  <span className="flex flex-wrap gap-1">
                    {Array.from({ length: guesses }, (_, index) => (
                      <span
                        key={index}
                        className={
                          "block h-2 w-2 rounded-[1px] border border-line-strong " +
                          (index < state.guessesUsed ? "bg-line-strong" : "")
                        }
                      />
                    ))}
                  </span>
                </div>
              </td>
              {grid.columns.map((column, index) => (
                <th
                  key={`col-${String(index)}`}
                  scope="col"
                  className={`${HEADER_WIDTH[size] ?? "w-1/4"} p-0 text-sm font-semibold`}
                >
                  <CriterionLabel criterion={column} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row, rowIndex) => (
              <tr key={`row-${String(rowIndex)}`}>
                <th
                  scope="row"
                  className={`${HEADER_WIDTH[size] ?? "w-1/4"} p-0 text-sm font-semibold`}
                >
                  <CriterionLabel criterion={row} />
                </th>
                {grid.columns.map((column, columnIndex) => {
                  const cell: CellRef = { row: rowIndex, column: columnIndex };
                  const answer = state.cells[cellKey(cell)];
                  const isOpen =
                    openCell?.row === rowIndex &&
                    openCell.column === columnIndex;

                  return (
                    <td
                      key={`cell-${String(columnIndex)}`}
                      /*
                        KONUMLANDIRMA GENİŞLİĞE GÖRE DEĞİŞİYOR.

                        `sm:relative` — hücre yalnızca geniş ekranda bir
                        konumlandırma bağlamı oluyor. Dar ekranda olmadığı
                        için, içindeki mutlak panel bir üstteki kutuya
                        (tablonun sarmalayıcısına) bağlanıyor ve tablonun
                        ALTINA, tam genişlikte açılıyor.

                        Gerekçe ölçüyle: 390 px'te ızgaranın tamamı ~350 px ve
                        bir hücre ~87 px. Hücreye kenetlenen 320 px'lik bir
                        panel orta sütunda görünür alanın dışına taşıyordu.
                        Üstelik "seçici hücreden uzakta kalıyor" sorunu dar
                        ekranda zaten yok: tablonun tamamı bir ekran boyu.
                      */
                      className="p-0 sm:relative"
                    >
                      <Cell
                        answer={answer}
                        isOpen={isOpen}
                        disabled={
                          finished ||
                          isChecking ||
                          isRevealing ||
                          answer !== undefined
                        }
                        label={`${row.label} ve ${column.label}`}
                        onOpen={() => {
                          setOpenCell(cell);
                        }}
                      />

                      {/*
                        SEÇİCİ HEDEF HÜCREYE KENETLİ — sayfanın dibine değil.

                        Önceki yerleşimde seçici tablonun TAMAMINDAN sonra
                        basılıyordu: sol üst hücreye tıklayan kullanıcı,
                        doldurduğu hücreyi göremeyecek kadar aşağıda bir
                        girdiyle karşılaşıyordu. Hangi hücrenin doldurulduğu
                        yalnızca seçicinin etiketindeki metinden anlaşılıyordu;
                        artık KONUMDAN da belli.

                        Son sütunda sağa yaslanır, yoksa panel görünür alanın
                        dışına taşardı.
                      */}
                      {isOpen && !finished && (
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
                            usedPlayerIds={usedPlayerIds}
                            search={searchPlayers}
                            onSelect={(player) => {
                              void submit(cell, player);
                            }}
                            onCancel={() => {
                              setOpenCell(null);
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

      {isChecking && (
        <p className="text-sm text-muted" aria-live="polite">
          Cevap kontrol ediliyor…
        </p>
      )}

      {isRevealing && (
        <p className="text-sm text-muted" aria-live="polite">
          Cevaplar getiriliyor…
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

      {finished && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm"
          role="status"
        >
          <p>
            Oyun bitti —{" "}
            <strong>
              {String(solvedCells)}/{String(guesses)}
            </strong>
            .{" "}
            {date === undefined
              ? "Bu ızgara kaydedilmez."
              : `Yeni ızgara her gün ${ROLLOVER_LABEL} (TSİ) yayınlanır.`}
          </p>
          {onRestart !== undefined && (
            <Button size="md" onClick={onRestart}>
              Yeni ızgara kur
            </Button>
          )}
        </div>
      )}

      {/*
        İŞLEM ÇUBUĞU — Pes et + Temizle (oyun sürerken) ve Skoru paylaş (bitince).
        "Pes et" boş hücrelerin örnek cevaplarını gösterir ve oyunu bitirir
        (BR-66); yalnızca `reveal` verildiğinde ve oyun sürerken görünür.
      */}
      {(answers.length > 0 ||
        finished ||
        (reveal !== undefined && !finished)) && (
        <div className="flex flex-wrap items-center gap-3">
          {reveal !== undefined && !finished && (
            <Button
              variant="outline"
              size="md"
              disabled={isRevealing || isChecking}
              onClick={() => {
                void giveUp();
              }}
            >
              Pes et
            </Button>
          )}
          {answers.length > 0 && (
            <Button variant="outline" size="md" onClick={clear}>
              Temizle
            </Button>
          )}
          {finished && (
            <>
              <SharePreview cells={state.cells} size={size} />
              <Button
                size="md"
                onClick={() => {
                  void share();
                }}
              >
                Skoru paylaş
              </Button>
            </>
          )}
          {shareStatus !== null && (
            <span
              role="status"
              aria-live="polite"
              className="text-sm text-muted"
            >
              {shareStatus}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Paylaş önizlemesi — hücre durumlarının renkli kare ızgarası.
 *
 * Arayüzde EMOJİ YOK (§7.12): önizleme gerçek renk tokenlarıyla çizilir;
 * emoji yalnızca kopyalanan paylaşım METNİNDE. `aria-hidden`: skor zaten
 * yanındaki metinde ve tabelada yazılı.
 */
function SharePreview({
  cells,
  size,
}: {
  readonly cells: Readonly<Record<string, CellState>>;
  readonly size: number;
}) {
  return (
    <span aria-hidden="true" className="inline-flex flex-col gap-0.5">
      {Array.from({ length: size }, (_, r) => (
        <span key={r} className="flex gap-0.5">
          {Array.from({ length: size }, (_, c) => {
            const answer = cells[cellKey({ row: r, column: c })];
            const tone =
              answer?.status === "correct"
                ? "bg-correct"
                : answer?.status === "wrong"
                  ? "bg-wrong"
                  : "bg-line";
            return <span key={c} className={`h-3 w-3 rounded-[2px] ${tone}`} />;
          })}
        </span>
      ))}
    </span>
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
    <span className="flex h-full flex-col items-center justify-center gap-1 rounded-xl bg-background px-2 py-3 text-center">
      {/* Ölçüt türü ikonu — kulüp mü uyruk mu, bir bakışta. GENEL bir simge:
          belirli bir arma/bayrak iddia etmez (DTO yalnızca `kind` taşır);
          `aria-hidden`, çünkü tür zaten alttaki "kulüp"/"uyruk" metninde. */}
      <CriterionIcon kind={criterion.kind} />
      {/* Ölçüt adı VERİDİR — kulüp/uyruk. Editorial imza: condensed (§7.12),
          oyuncu adlarıyla aynı yüz. Büyük harf DEĞİL: özel ad. */}
      <span className="font-display leading-tight font-bold tracking-tight text-balance">
        {criterion.label}
      </span>
      <DataLabel className="text-muted">
        {criterion.kind === "club" ? "kulüp" : "uyruk"}
      </DataLabel>
    </span>
  );
}

/** Ölçüt türü rozeti — kulüp için kalkan, uyruk için flama. Süsleme (§7.12). */
function CriterionIcon({ kind }: { readonly kind: GridCriterionDto["kind"] }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="h-4 w-4 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "club" ? (
        <path d="M12 3 5 6v5c0 4 3 6.9 7 8 4-1.1 7-4 7-8V6l-7-3Z" />
      ) : (
        <>
          <path d="M6 21V4" />
          <path d="M6 4h11l-2.4 3.4L17 11H6" />
        </>
      )}
    </svg>
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
    // AÇIĞA ÇIKAN HÜCRE (BR-66): ne doğru ne yanlış — gösterilen örnek cevap.
    // Nötr ton (yeşil/kırmızı değil); kullanıcının bulduğu bir doğru gibi
    // görünmesin. Durum metinle de belli ("Cevap" + sr-only), renkle değil.
    if (answer.status === "revealed") {
      return (
        <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-line-strong bg-surface px-2 text-center text-sm sm:h-28">
          <DataLabel className="text-muted">Cevap</DataLabel>
          <span className="font-display leading-tight font-bold tracking-tight text-balance text-muted">
            {answer.playerName}
          </span>
          <span className="sr-only">
            {label}: {answer.playerName} — cevap gösterildi
          </span>
        </div>
      );
    }

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
        <span className="font-display leading-tight font-bold tracking-tight text-balance">
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
      className="group flex h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line-strong bg-background text-sm transition-colors hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:bg-background sm:h-28"
      onClick={onOpen}
    >
      <span
        aria-hidden="true"
        className="text-2xl leading-none font-light text-muted transition-colors group-hover:text-accent"
      >
        +
      </span>
      {/* Görünen ipucu — aria-hidden, çünkü erişilebilir ad zaten aşağıdaki
          sr-only etikette ("... için oyuncu seçin"); ikisi birlikte okunmasın. */}
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
