import { GRID_SIZE, isCellRefInRange, type CellRef } from "./grid";
import {
  MAX_ROOM_PLAYERS,
  ROOM_JOIN_WINDOW_MS,
  ROOM_PLAY_WINDOW_MS,
  type RoomJoinVerdict,
  type RoomStatus,
} from "./room";

/**
 * Izgara odası — ÜÇÜNCÜ oda modu (XOX), PROJECT.md §12.9, BR-71…BR-76.
 *
 * Saf kural: depolama, kimlik, rastgelelik, veri erişimi ve saat burada YOKTUR
 * (§2.1); saat bir PARAMETREDİR (`now`). Oda ALTYAPISI (kod, kur/katıl, yoklama,
 * sönme, giriş şartı) §12'den olduğu gibi geliyor; buradaki yeni şey SIRA
 * (BR-72), hamlenin ortak tahtaya etkisi (BR-73) ve XOX galibi (BR-75).
 *
 * NEDEN AYRI DOSYA — `which-more-room.ts` ile aynı gerekçe. İki paralel modun
 * (İstatistik, Hangisi Daha) "bitmişliği" oyuncuların KENDİ ilerlemesine bakar;
 * XOX'unki ORTAK TAHTANIN durumuna bakar ve öncekilerde karşılığı olmayan bir
 * SIRA kavramı taşır. Ortak olan pencere sabitleri (`ROOM_*_WINDOW_MS`),
 * `RoomStatus` ve `RoomJoinVerdict` ise ödünç alınıyor, kopyalanmıyor.
 *
 * IZGARANIN KENDİSİ BURADA DEĞİL. Ölçütlerin (satır/sütun) üretimi ve bir
 * cevabın doğruluğu `application/game-modes/grid` + `daily-grid.ts` içinde;
 * bu dosya yalnızca HAMLELERİ okuyup tahtayı/sırayı/galibi türetir.
 */

/** XOX işaretleri — ilk hamleyi yapan koltuk X, diğeri O (BR-76). */
export const GRID_MARKS = ["X", "O"] as const;
export type GridMark = (typeof GRID_MARKS)[number];

/**
 * Odanın oyun yapılandırması — BR-71. Sınırda **Zod** ile ayrıştırılır (§2.3);
 * bu tip ayrıştırılmış, güvenli hâlidir.
 *
 * `seed` ortak ızgarayı belirler: iki oyuncu aynı tohumdan aynı 3×3'ü görür
 * (ızgara SUNUCUDA üretilir, bu tip yalnızca tohumu taşır). `firstSeat` ilk
 * hamleyi (X) yapan KOLTUĞU söyler (0 = kurucu, 1 = katılan) ve tohumdan
 * türetilir (BR-76) — kim X, kim O buradan çıkar.
 */
export interface GridRoomConfig {
  readonly seed: number;
  readonly firstSeat: 0 | 1;
}

/**
 * Tek bir hamle — GLOBAL sıralı.
 *
 * Paralel modların per-oyuncu cevabının aksine, XOX'ta sıra oyuncular ARASINDA
 * gider; bu yüzden hamleler tek bir dizide toplanır ve her biri kimin yaptığını
 * (`userId`) taşır. `correct` istemciden GELMEZ: sunucu ızgarayı tohumdan üretip
 * doğruluğu kendi hesaplar (BR-73/BR-12). Yanlış hamle de bir hamledir —
 * hücreyi öldürür ama sırayı yine geçirir, o yüzden `moveIndex`'te yerini alır.
 */
export interface GridMove {
  readonly moveIndex: number;
  readonly userId: string;
  readonly cell: CellRef;
  /** Oynanan futbolcu — tahtada gösterilir (BR-74); doğrulukla ilgisi yok. */
  readonly playerId: string;
  readonly correct: boolean;
}

export interface GridRoomPlayer {
  readonly userId: string;
  /** Sonuç ekranı ad gösterir (BR-54); kimlik numarası okunmaz. */
  readonly displayName: string;
}

/**
 * Odanın saf alan durumu — depolama kimliklerinden arınmış.
 *
 * `players` KOLTUK sırasıyla (0 = kurucu, 1 = katılan); `firstSeat` bu sıraya
 * göre X'i belirler. `moves` GLOBAL sıralı — tahta, sıra ve galip bundan
 * türetilir (§12.3); ayrı `turn`/`board`/`winner` alanı YOK.
 */
export interface GridRoomState {
  readonly createdAt: Date;
  readonly startedAt: Date | null;
  readonly config: GridRoomConfig;
  readonly players: readonly GridRoomPlayer[];
  readonly moves: readonly GridMove[];
}

/** Bir oyuncunun koltuğu (0/1); üye değilse -1. */
export function seatOf(state: GridRoomState, userId: string): number {
  return state.players.findIndex((player) => player.userId === userId);
}

/** Bir koltuğun işareti — `firstSeat` X, diğeri O (BR-76). */
export function markForSeat(config: GridRoomConfig, seat: number): GridMark {
  return seat === config.firstSeat ? "X" : "O";
}

/** Bir işaretin koltuğu — `markForSeat`'in tersi. */
function seatForMark(config: GridRoomConfig, mark: GridMark): 0 | 1 {
  if (mark === "X") return config.firstSeat;
  return config.firstSeat === 0 ? 1 : 0;
}

/** Bir oyuncunun işareti; üye değilse `null`. */
export function markOf(state: GridRoomState, userId: string): GridMark | null {
  const seat = seatOf(state, userId);
  return seat < 0 ? null : markForSeat(state.config, seat);
}

/**
 * Bir hücrenin hâli.
 *
 * `bos`: hiç oynanmadı. `kapali`: bir oyuncu doğru cevapla kaptı (işaret +
 * futbolcu). `olu`: bir oyuncu yanlış cevap verdi, hücre nötr — kimse kapayamaz
 * (BR-73). `olu` hücrenin de bir `playerId`'si var (yanlış denenen futbolcu);
 * bir sır değil, tahta onu da gösterebilir.
 */
export type GridCell =
  | { readonly kind: "bos" }
  | {
      readonly kind: "kapali";
      readonly mark: GridMark;
      readonly userId: string;
      readonly playerId: string;
    }
  | {
      readonly kind: "olu";
      readonly userId: string;
      readonly playerId: string;
    };

export type GridBoard = readonly (readonly GridCell[])[];

/** Hamleleri `moveIndex`'e göre ARTAN sıralar — depo sırası garanti değil. */
function orderedMoves(moves: readonly GridMove[]): readonly GridMove[] {
  return [...moves].sort((a, b) => a.moveIndex - b.moveIndex);
}

function emptyBoard(): GridCell[][] {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, (): GridCell => ({ kind: "bos" })),
  );
}

/**
 * Hamleleri tahtaya oynar — BR-73.
 *
 * Doğru hamle hücreyi oyuncunun işaretiyle KAPATIR; yanlış hamle hücreyi
 * ÖLDÜRÜR. İkisi de hücreyi doldurur, yani `bos`'tan çıkarır. Aralık dışı ya
 * da üye olmayan hamle savunmacı olarak ATLANIR (sunucu bunları hiç yazmaz;
 * yine de tür güvenliği ve bozuk veriye karşı sessizce geçilir).
 */
export function boardAt(state: GridRoomState): GridBoard {
  const board = emptyBoard();

  for (const move of orderedMoves(state.moves)) {
    const seat = seatOf(state, move.userId);
    if (seat < 0) continue;
    if (!isCellRefInRange(move.cell)) continue;

    const row = board[move.cell.row];
    if (row === undefined) continue;

    row[move.cell.column] = move.correct
      ? {
          kind: "kapali",
          mark: markForSeat(state.config, seat),
          userId: move.userId,
          playerId: move.playerId,
        }
      : { kind: "olu", userId: move.userId, playerId: move.playerId };
  }

  return board;
}

export function cellAt(board: GridBoard, cell: CellRef): GridCell | null {
  return board[cell.row]?.[cell.column] ?? null;
}

/**
 * XOX kazanan çizgileri — her satır, her sütun, iki köşegen.
 *
 * `GRID_SIZE`'dan TÜRETİLİR, elle yazılmaz: kural "boydan boya aynı işaret" ve
 * bu her kare boyutta aynı biçimde kurulur. XOX 3×3 sabittir (BR-71) ama sayıyı
 * tek yerden okumak, sabit bir "3" serpiştirmekten güvenli.
 */
export function winningLines(): readonly (readonly CellRef[])[] {
  const lines: CellRef[][] = [];

  for (let i = 0; i < GRID_SIZE; i++) {
    const row: CellRef[] = [];
    const column: CellRef[] = [];
    for (let j = 0; j < GRID_SIZE; j++) {
      row.push({ row: i, column: j });
      column.push({ row: j, column: i });
    }
    lines.push(row, column);
  }

  const diagonal: CellRef[] = [];
  const antiDiagonal: CellRef[] = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    diagonal.push({ row: i, column: i });
    antiDiagonal.push({ row: i, column: GRID_SIZE - 1 - i });
  }
  lines.push(diagonal, antiDiagonal);

  return lines;
}

/**
 * Tahtada tamamlanmış bir çizginin işareti; yoksa `null` (BR-75).
 *
 * Bir çizgi ancak ÜÇÜ DE aynı oyuncunun kapattığı hücreyse kazanır — ölü ya da
 * boş bir hücre çizgiyi kırar.
 */
export function lineWinnerMark(board: GridBoard): GridMark | null {
  for (const line of winningLines()) {
    const cells = line.map((ref) => cellAt(board, ref));
    const first = cells[0];
    if (first === null || first === undefined || first.kind !== "kapali") {
      continue;
    }
    if (
      cells.every(
        (cell) =>
          cell !== null && cell.kind === "kapali" && cell.mark === first.mark,
      )
    ) {
      return first.mark;
    }
  }
  return null;
}

/** Bir işaretin kapadığı hücre sayısı (BR-75'in "çok hücre" ölçütü). */
export function cellCount(board: GridBoard, mark: GridMark): number {
  let count = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.kind === "kapali" && cell.mark === mark) count += 1;
    }
  }
  return count;
}

/** Tahta doldu mu — hiç `bos` hücre kalmadı (her hamle bir hücre kapatır). */
export function isBoardFull(board: GridBoard): boolean {
  return board.every((row) => row.every((cell) => cell.kind !== "bos"));
}

export type GridRoomResult =
  /** Sonuç henüz KESİNLEŞMEDİ (süre/sönme ayrı bir sorudur, bkz. `gridRoomOutcome`). */
  | { readonly kind: "devam" }
  /** BR-75 — tahta 3'lüsüz doldu, hücre sayıları eşit (BR-62 hattı). */
  | { readonly kind: "beraberlik"; readonly cells: number }
  | {
      readonly kind: "galip";
      readonly winnerId: string;
      readonly winnerCells: number;
      readonly loserCells: number;
      /** `cizgi`: 3'lü sıra; `hucre`: tahta dolunca çok hücre. */
      readonly via: "cizgi" | "hucre";
    };

/**
 * Maçın SAF sonucu — zamandan bağımsız (BR-75).
 *
 * Karar sırası: (1) bir işaret 3'lü sıra tamamladıysa o kazanır ve maç o an
 * biter — kalan hücreler oynanmaz. (2) Değilse ve tahta DOLDUYSA, çok hücre
 * kapan kazanır; eşitse beraberlik. (3) Aksi hâlde karar yok (`devam`).
 *
 * İki oyuncu yoksa sonuç olamaz. Zaman/sönme bu fonksiyonun konusu değil; onu
 * `gridRoomOutcome` ekliyor (which-more/İstatistik ile aynı ayrım).
 */
export function gridRoomResult(state: GridRoomState): GridRoomResult {
  const [a, b] = state.players;
  if (a === undefined || b === undefined) return { kind: "devam" };

  const board = boardAt(state);

  const winnerMark = lineWinnerMark(board);
  if (winnerMark !== null) {
    const winnerSeat = seatForMark(state.config, winnerMark);
    const winner = state.players[winnerSeat];
    if (winner === undefined) return { kind: "devam" };
    const loserMark: GridMark = winnerMark === "X" ? "O" : "X";
    return {
      kind: "galip",
      winnerId: winner.userId,
      winnerCells: cellCount(board, winnerMark),
      loserCells: cellCount(board, loserMark),
      via: "cizgi",
    };
  }

  if (!isBoardFull(board)) return { kind: "devam" };

  const xCells = cellCount(board, "X");
  const oCells = cellCount(board, "O");
  if (xCells === oCells) return { kind: "beraberlik", cells: xCells };

  const winnerMarkByCells: GridMark = xCells > oCells ? "X" : "O";
  const winnerSeat = seatForMark(state.config, winnerMarkByCells);
  const winner = state.players[winnerSeat];
  if (winner === undefined) return { kind: "devam" };
  return {
    kind: "galip",
    winnerId: winner.userId,
    winnerCells: Math.max(xCells, oCells),
    loserCells: Math.min(xCells, oCells),
    via: "hucre",
  };
}

/** Maç kesinleşti mi — `bitti` durumunun kapısı. */
export function isGridRoomDecided(state: GridRoomState): boolean {
  return gridRoomResult(state).kind !== "devam";
}

/**
 * Sıradaki koltuk — BR-72.
 *
 * `k`'ıncı hamleyi `(firstSeat + k) % 2` koltuğu yapar: sıra HER hamlede geçer
 * (doğru da yanlış da, BR-73). Bir sonraki hamlenin sahibi bu yüzden
 * `(firstSeat + hamle sayısı) % 2`. Bu türetim, sunucunun sıra dışı hamleyi
 * reddettiğine (BR-72) güvenir — dizideki her hamle doğru koltuktan gelmiştir.
 */
export function nextSeat(state: GridRoomState): 0 | 1 {
  return ((state.config.firstSeat + state.moves.length) % 2) as 0 | 1;
}

/**
 * Sırası gelen oyuncunun kimliği; sıra yoksa `null`.
 *
 * İki oyuncu yoksa (henüz katılım bekleniyor) ya da maç kesinleştiyse sıra
 * kavramı yok — `null`.
 */
export function whoseTurn(state: GridRoomState): string | null {
  if (state.players.length < MAX_ROOM_PLAYERS) return null;
  if (isGridRoomDecided(state)) return null;
  return state.players[nextSeat(state)]?.userId ?? null;
}

export type GridMoveRejection =
  "oda-kapali" | "gecersiz-hucre" | "hucre-dolu" | "sira-degil";

export type GridMoveVerdict =
  | { readonly kind: "izin"; readonly mark: GridMark }
  | { readonly kind: "ret"; readonly reason: GridMoveRejection };

/**
 * BR-72/BR-73 — bir hamle geçerli mi?
 *
 * SIRA: önce oda oynanır durumda mı (sönmüş/bitmiş odaya hamle giremez), sonra
 * hücre aralıkta ve BOŞ mu, sonra sıra gerçekten bu oyuncuda mı. Sıra denetimi
 * sona bırakıldı çünkü sıra dışı bir hamlenin en anlamlı reddi "sıra sende
 * değil"dir; ama dolu/geçersiz hücre önce yakalanır ki kullanıcı yanlış sebep
 * görmesin. Üyelik use-case'te denetlenir; üye olmayan zaten hiçbir zaman
 * `whoseTurn` olmadığından burada `sira-degil` alır (güvenlik ağı).
 */
export function judgeGridMove(
  state: GridRoomState,
  userId: string,
  cell: CellRef,
  now: Date,
): GridMoveVerdict {
  if (gridRoomStatus(state, now) !== "oynaniyor") {
    return { kind: "ret", reason: "oda-kapali" };
  }
  if (!isCellRefInRange(cell)) {
    return { kind: "ret", reason: "gecersiz-hucre" };
  }

  const occupant = cellAt(boardAt(state), cell);
  if (occupant === null) return { kind: "ret", reason: "gecersiz-hucre" };
  if (occupant.kind !== "bos") return { kind: "ret", reason: "hucre-dolu" };

  if (whoseTurn(state) !== userId) return { kind: "ret", reason: "sira-degil" };

  const seat = seatOf(state, userId);
  return { kind: "izin", mark: markForSeat(state.config, seat) };
}

/**
 * Odanın ölüm anı — BR-60 (İstatistik/Hangisi Daha ile aynı iki pencere).
 *
 * Pencere sabitleri PAYLAŞILIYOR; ayrı durmasının tek sebebi girdinin
 * `GridRoomState` olması.
 */
export function gridRoomDeadline(state: GridRoomState): Date {
  return state.startedAt === null
    ? new Date(state.createdAt.getTime() + ROOM_JOIN_WINDOW_MS)
    : new Date(state.startedAt.getTime() + ROOM_PLAY_WINDOW_MS);
}

/**
 * Odanın durumu — SAKLANMAZ, TÜRETİLİR (§12.3).
 *
 * KESİNLEŞME SAATTEN ÖNCE GELİR (`roomStatus` ile aynı gerekçe): 59. dakikada
 * kazanılmış bir maç 61. dakikada "süresi doldu" olmamalı.
 */
export function gridRoomStatus(state: GridRoomState, now: Date): RoomStatus {
  if (isGridRoomDecided(state)) return "bitti";
  if (now.getTime() >= gridRoomDeadline(state).getTime()) {
    return "suresi-doldu";
  }
  return state.startedAt === null ? "bekliyor" : "oynaniyor";
}

export type GridRoomOutcome =
  | { readonly kind: "devam" }
  /** BR-61 hattı — biri bırakıp gitti; hükmen galip YOK. */
  | { readonly kind: "yarim" }
  | { readonly kind: "beraberlik"; readonly cells: number }
  | {
      readonly kind: "galip";
      readonly winnerId: string;
      readonly winnerCells: number;
      readonly loserCells: number;
      readonly via: "cizgi" | "hucre";
    };

/**
 * Odanın sonucu, ZAMANLA birlikte — BR-61/BR-75.
 *
 * Kesinleşmiş maç sonucunu verir; sönmüş ama kesinleşmemiş maç `yarim`, gerisi
 * `devam`. Kesinleşme saatten önce geldiği için önce durum sorulur.
 */
export function gridRoomOutcome(
  state: GridRoomState,
  now: Date,
): GridRoomOutcome {
  const status = gridRoomStatus(state, now);
  if (status === "suresi-doldu") return { kind: "yarim" };
  if (status !== "bitti") return { kind: "devam" };

  const result = gridRoomResult(state);
  // `bitti` sonucun kesinleştiğini garanti eder; bu dal yalnızca tipi daraltır.
  if (result.kind === "devam") return { kind: "devam" };
  return result;
}

/** İki oyuncu da katıldı mı — sıra ancak o zaman başlar (BR-72). */
export function isGridRoomFull(state: GridRoomState): boolean {
  return state.players.length === MAX_ROOM_PLAYERS;
}

export function isGridMember(state: GridRoomState, userId: string): boolean {
  return state.players.some((player) => player.userId === userId);
}

/**
 * BR-54 — katılma kararı (İstatistik `judgeJoin`'in karşılığı).
 *
 * SIRA AYNI: önce üyelik, sonra kapılık, sonra doluluk — dolu bir odanın kendi
 * üyesi sayfayı yenilediğinde "oda dolu" hatası almasın diye. `RoomJoinVerdict`
 * sözlüğü ödünç alınıyor (kopyalanmıyor).
 */
export function judgeGridJoin(
  state: GridRoomState,
  userId: string,
  now: Date,
): RoomJoinVerdict {
  if (isGridMember(state, userId)) return { kind: "zaten-uye" };

  const status = gridRoomStatus(state, now);
  if (status !== "bekliyor") return { kind: "ret", reason: "oda-kapali" };

  if (state.players.length >= MAX_ROOM_PLAYERS) {
    return { kind: "ret", reason: "oda-dolu" };
  }

  return { kind: "katil" };
}
