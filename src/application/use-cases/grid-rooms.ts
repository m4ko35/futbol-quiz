import { z } from "zod";
import {
  GridUnavailableError,
  ValidationError,
} from "@/domain/errors/domain-error";
import {
  isCellRefInRange,
  type CellRef,
  type Grid,
  type GridCriterion,
} from "@/domain/services/grid";
import {
  boardAt,
  gridRoomDeadline,
  gridRoomOutcome,
  gridRoomStatus,
  isGridMember,
  judgeGridJoin,
  judgeGridMove,
  markForSeat,
  seatOf,
  whoseTurn,
  type GridBoard,
  type GridMark,
  type GridRoomConfig,
} from "@/domain/services/grid-room";
import type { RoomJoinRejection, RoomStatus } from "@/domain/services/room";
import {
  ROOM_JOIN_WINDOW_MS,
  ROOM_PLAY_WINDOW_MS,
} from "@/domain/services/room";
import {
  createSeededRandom,
  seedFromBytes,
} from "@/domain/value-objects/seeded-random";
import type { PlayerId } from "@/domain/value-objects/identifiers";
import { roomCodeFromBytes } from "@/domain/value-objects/room-code";
import type { RandomSource } from "../ports/random-source";
import type {
  GridRoomsRepository,
  StoredGridRoom,
} from "../ports/grid-rooms-repository";
import { generateGrid, type GridDeps } from "../game-modes/grid/generate";
import type { GridCriterionDto } from "./daily-grid";

/**
 * Izgara odasının orkestrasyonu — PROJECT.md §12.9.
 *
 * OYUN YENİDEN TANIMLANMIYOR. Yaşam döngüsü (kod, katıl, sönme, giriş şartı)
 * diğer oda modlarıyla aynı desende; buradaki yeni şey SIRA ZORLAMASI (BR-72),
 * hamlenin doğrulanıp ortak tahtaya yazılması (BR-73) ve ORTAK IZGARANIN
 * tohumdan sunucuda üretilmesi (BR-71).
 */

/**
 * Odanın saklanan yapılandırmasının Zod şeması — BR-71, §2.3.
 *
 * SINIRDA DOĞRULAMA. `config` veritabanında JSON metni olarak durur; iç
 * katmanlara geçmeden önce burada ayrıştırılır. `firstSeat` yalnızca 0 ya da 1
 * olabilir (koltuk) — başka bir değer domain'in sıra türetimini bozardı.
 */
export const gridRoomConfigSchema = z.object({
  seed: z.number().int(),
  firstSeat: z.union([z.literal(0), z.literal(1)]),
});

/**
 * Üretilmiş ızgaranın gün bazlı belleği — `daily-grid.ts`'in cache'iyle aynı
 * gerekçe (§9.1): üretim gerçek depolarla ~432 ms, yoklama altında her istekte
 * yeniden üretmek pahalı. Anahtar `config.seed`; günlük ızgaradan farklı
 * tohumlar taşır, o yüzden ayrı bellek. Süreç içi ve sınırlı (§7.1).
 *
 * Neden daily-grid'in cache'i paylaşılmadı: o cache modül-özel; paylaşmak
 * çalışan solo yolu bu değişikliğe bağlardı. İki bellek ayrı tohum uzayında
 * çalışır, çakışmaz.
 */
const gridCache = new Map<number, Grid>();
const MAX_CACHED_GRIDS = 16;

async function gridFor(seed: number, deps: GridDeps): Promise<Grid> {
  const cached = gridCache.get(seed);
  if (cached !== undefined) return cached;

  const grid = await generateGrid(seed, deps);
  if (grid === null) throw new GridUnavailableError();

  if (gridCache.size >= MAX_CACHED_GRIDS) {
    const oldest = gridCache.keys().next();
    if (!oldest.done) gridCache.delete(oldest.value);
  }
  gridCache.set(seed, grid);
  return grid;
}

export interface GridRoomDeps {
  readonly rooms: GridRoomsRepository;
  /** Izgara üretimi ve cevap doğrulaması için — yalnızca kulüp + oyuncu portu. */
  readonly grid: GridDeps;
  readonly random: RandomSource;
}

type PresentDeps = Pick<GridRoomDeps, "grid">;

/** Kod üretimi kaç kez denenir — diğer odalarla aynı gerekçe. */
const CODE_ATTEMPTS = 5;
/** Her denemede istenen bayt — yanlılık elemesi bazılarını atar. */
const CODE_BYTES = 16;

export type GridRoomOutcomeKind =
  "devam" | "yarim" | "beraberlik" | "kazandin" | "kaybettin";

/** Bir hücrenin istemciye giden hâli — ölçüt adı değil, KAPANIŞ durumu. */
export type GridCellDto =
  | { readonly kind: "bos" }
  | {
      readonly kind: "kapali";
      readonly mark: GridMark;
      readonly playerName: string;
      /** Bu hücreyi ben mi kapattım — arayüz "senin" diye işaretler. */
      readonly mine: boolean;
    }
  | {
      readonly kind: "olu";
      readonly playerName: string;
      readonly mine: boolean;
    };

export interface GridRoomSideDto {
  readonly displayName: string;
  readonly mark: GridMark;
}

export interface GridRoomDto {
  /** §12.9 — istemci hangi oda şekliyle konuştuğunu buradan ayırt eder (BR-71). */
  readonly mode: "izgara";
  readonly code: string;
  readonly status: RoomStatus;
  readonly expiresAt: string;
  /** Ortak ızgaranın ölçütleri — tahta ikisine de AÇIK (gizli hedef yok). */
  readonly rows: readonly GridCriterionDto[];
  readonly columns: readonly GridCriterionDto[];
  readonly me: GridRoomSideDto;
  /** Henüz kimse katılmadıysa `null`. */
  readonly opponent: GridRoomSideDto | null;
  /** 3×3 tahta — her hücre boş / kapalı (işaret + futbolcu) / ölü. */
  readonly board: readonly (readonly GridCellDto[])[];
  /** Sıra bende mi (BR-72). */
  readonly yourTurn: boolean;
  readonly outcome: GridRoomOutcomeKind;
}

function toCriterionDto(criterion: GridCriterion): GridCriterionDto {
  return { kind: criterion.type, label: criterion.label };
}

/** İsim çözülemezse (veri yenilenip oyuncu düşerse) nötr yer tutucu. */
const UNKNOWN_NAME = "—";

function boardDto(
  board: GridBoard,
  userId: string,
  names: ReadonlyMap<string, string>,
): readonly (readonly GridCellDto[])[] {
  return board.map((row) =>
    row.map((cell): GridCellDto => {
      if (cell.kind === "bos") return { kind: "bos" };
      const playerName = names.get(cell.playerId) ?? UNKNOWN_NAME;
      const mine = cell.userId === userId;
      return cell.kind === "kapali"
        ? { kind: "kapali", mark: cell.mark, playerName, mine }
        : { kind: "olu", playerName, mine };
    }),
  );
}

function outcomeKind(
  room: StoredGridRoom,
  userId: string,
  now: Date,
): GridRoomOutcomeKind {
  const outcome = gridRoomOutcome(room.state, now);
  switch (outcome.kind) {
    case "devam":
    case "yarim":
    case "beraberlik":
      return outcome.kind;
    case "galip":
      return outcome.winnerId === userId ? "kazandin" : "kaybettin";
  }
}

/**
 * Odanın kullanıcıya görünen hâli.
 *
 * TAHTA HERKESE AÇIK: paralel modların BR-63/BR-70 gizlemesinin karşılığı YOK
 * (sıra tabanlı oyunda tahta zaten ortak). İsimler kimlikten çözülür
 * (`findNames`) — İstatistik odasının saklanan turu ekrana getirmesiyle aynı
 * desen; adlar hesap veritabanına kopyalanmaz (§11.3).
 */
async function presentGrid(
  room: StoredGridRoom,
  userId: string,
  now: Date,
  deps: PresentDeps,
): Promise<GridRoomDto> {
  const { state } = room;
  const status = gridRoomStatus(state, now);

  const me = state.players.find((player) => player.userId === userId);
  if (me === undefined) throw new ValidationError("Bu odanın üyesi değilsin.");
  const other = state.players.find((player) => player.userId !== userId);

  const grid = await gridFor(state.config.seed, deps.grid);
  const board = boardAt(state);

  const ids = state.moves.map((move) => move.playerId);
  const names =
    ids.length === 0
      ? new Map<string, string>()
      : await deps.grid.players.findNames(ids as PlayerId[]);

  return {
    mode: "izgara",
    code: room.code,
    status,
    expiresAt: gridRoomDeadline(state).toISOString(),
    rows: grid.rows.map(toCriterionDto),
    columns: grid.columns.map(toCriterionDto),
    me: {
      displayName: me.displayName,
      mark: markForSeat(state.config, seatOf(state, userId)),
    },
    opponent:
      other === undefined
        ? null
        : {
            displayName: other.displayName,
            mark: markForSeat(state.config, seatOf(state, other.userId)),
          },
    board: boardDto(board, userId, names),
    yourTurn: whoseTurn(state) === userId,
    outcome: outcomeKind(room, userId, now),
  };
}

export interface CreateGridRoomInput {
  readonly now: Date;
  readonly userId: string;
}

/**
 * Girdiden TOHUMLU config kurar — tohum crypto'dan (tahmin edilemez).
 *
 * `firstSeat` (ilk hamleyi/X'i yapan koltuk, BR-76) TOHUMDAN türetilir: aynı
 * tohum aynı ilk koltuğu verir (belirlenimci, tekrar oynatılabilir). Ayrı bir
 * crypto çekilişi yerine tohuma bağlamak, config'in tek rastgelelik kaynağını
 * korur.
 */
function buildGridConfig(random: RandomSource): GridRoomConfig {
  const seed = seedFromBytes(random.bytes(4));
  const firstSeat = createSeededRandom(seed)() < 0.5 ? 0 : 1;
  return { seed, firstSeat };
}

/**
 * Oda kurulmadan önce ortak ızgaranın gerçekten üretilebildiğini doğrular.
 *
 * Oynanmayacak bir oda (havuz o tohumla ızgara kuramıyor) kullanıcıyı çalışmayan
 * bir koda gönderirdi — Hangisi Daha `assertRailPlayable` ile aynı gerekçe.
 * `gridFor` üretilemezse `GridUnavailableError` atar; temiz bir ret'e çevrilir
 * (§6.3, sızıntı yok).
 */
async function assertGridPlayable(
  seed: number,
  deps: PresentDeps,
): Promise<void> {
  try {
    await gridFor(seed, deps.grid);
  } catch (error: unknown) {
    if (error instanceof GridUnavailableError) {
      throw new ValidationError(
        "Şu an oda kurulamıyor: ızgara üretilemedi. Lütfen tekrar deneyin.",
      );
    }
    throw error;
  }
}

export async function createGridRoom(
  input: CreateGridRoomInput,
  deps: GridRoomDeps,
): Promise<GridRoomDto> {
  // ÖNCE TEMİZLİK — BR-60 (diğer odalarla aynı).
  await deps.rooms.deleteHostedRooms(input.userId);
  await deps.rooms.deleteExpiredRooms({
    unjoinedBefore: new Date(input.now.getTime() - ROOM_JOIN_WINDOW_MS),
    unfinishedBefore: new Date(input.now.getTime() - ROOM_PLAY_WINDOW_MS),
  });

  const config = buildGridConfig(deps.random);
  await assertGridPlayable(config.seed, deps);

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = roomCodeFromBytes(deps.random.bytes(CODE_BYTES));
    if (code === null) continue;

    const result = await deps.rooms.createRoom({
      hostId: input.userId,
      code,
      config,
    });

    if (result.kind === "kuruldu") {
      return presentGrid(result.room, input.userId, input.now, deps);
    }
  }

  throw new ValidationError("Oda kodu üretilemedi. Lütfen tekrar deneyin.");
}

export interface GridRoomByCodeInput {
  readonly now: Date;
  readonly userId: string;
  readonly code: string;
}

async function requireGridRoom(
  code: string,
  deps: GridRoomDeps,
): Promise<StoredGridRoom> {
  const room = await deps.rooms.findByCode(code);
  if (room === null) {
    throw new ValidationError("Böyle bir oda yok. Kodu kontrol edin.");
  }
  return room;
}

export async function joinGridRoom(
  input: GridRoomByCodeInput,
  deps: GridRoomDeps,
): Promise<GridRoomDto> {
  const room = await requireGridRoom(input.code, deps);
  const verdict = judgeGridJoin(room.state, input.userId, input.now);

  switch (verdict.kind) {
    case "zaten-uye":
      return presentGrid(room, input.userId, input.now, deps);

    case "ret":
      throw new ValidationError(
        verdict.reason === "oda-dolu"
          ? "Bu oda dolu."
          : "Bu oda artık açık değil.",
      );

    case "katil": {
      const result = await deps.rooms.joinRoom({
        roomId: room.id,
        userId: input.userId,
        startedAt: input.now,
      });

      if (result.kind === "dolu") throw new ValidationError("Bu oda dolu.");

      return presentGrid(result.room, input.userId, input.now, deps);
    }
  }
}

export async function getGridRoom(
  input: GridRoomByCodeInput,
  deps: GridRoomDeps,
): Promise<GridRoomDto> {
  const room = await requireGridRoom(input.code, deps);

  if (!isGridMember(room.state, input.userId)) {
    throw new ValidationError("Bu odanın üyesi değilsin.");
  }

  return presentGrid(room, input.userId, input.now, deps);
}

export type GridRoomEntry =
  | { readonly kind: "uye"; readonly room: GridRoomDto }
  | { readonly kind: "katilabilir" }
  | { readonly kind: "kapali"; readonly reason: RoomJoinRejection }
  | { readonly kind: "yok" };

export async function peekGridRoom(
  input: GridRoomByCodeInput,
  deps: GridRoomDeps,
): Promise<GridRoomEntry> {
  const room = await deps.rooms.findByCode(input.code);
  if (room === null) return { kind: "yok" };

  if (isGridMember(room.state, input.userId)) {
    return {
      kind: "uye",
      room: await presentGrid(room, input.userId, input.now, deps),
    };
  }

  const verdict = judgeGridJoin(room.state, input.userId, input.now);
  return verdict.kind === "ret"
    ? { kind: "kapali", reason: verdict.reason }
    : { kind: "katilabilir" };
}

export interface SubmitGridMoveInput extends GridRoomByCodeInput {
  readonly row: number;
  readonly column: number;
  readonly playerId: string;
}

export interface SubmitGridMoveDto {
  readonly correct: boolean;
  readonly room: GridRoomDto;
}

/** Kullanıcının bu hücredeki mevcut hamlesi — ağ tekrarında idempotanlık için. */
function myMoveAt(
  room: StoredGridRoom,
  userId: string,
  cell: CellRef,
): { readonly correct: boolean } | undefined {
  return room.state.moves.find(
    (move) =>
      move.userId === userId &&
      move.cell.row === cell.row &&
      move.cell.column === cell.column,
  );
}

/**
 * Bir hamleyi işler — BR-72/BR-73.
 *
 * SIRA: (1) ağ tekrarı mı — bu hücreyi ben zaten oynadıysam SAKLANANI dön
 * (idempotanlık, `submitWhichMoreAnswer`'ın "zaten-var" dalıyla aynı). (2) Domain
 * yargısı (sıra/oda/hücre). (3) Cevabı SUNUCUDA doğrula (ızgarayı tohumdan üret,
 * `matchesAll`) — YANLIŞ cevap hata değil, hücreyi öldüren geçerli bir hamle.
 * (4) Yaz; eşzamanlı yarışı veritabanı kısıtı durdurur.
 */
export async function submitGridMove(
  input: SubmitGridMoveInput,
  deps: GridRoomDeps,
): Promise<SubmitGridMoveDto> {
  const room = await requireGridRoom(input.code, deps);

  if (!isGridMember(room.state, input.userId)) {
    throw new ValidationError("Bu odanın üyesi değilsin.");
  }

  const cell: CellRef = { row: input.row, column: input.column };

  // (1) Ağ tekrarı — bu hücreyi ben zaten oynadım.
  const mine = myMoveAt(room, input.userId, cell);
  if (mine !== undefined) {
    return {
      correct: mine.correct,
      room: await presentGrid(room, input.userId, input.now, deps),
    };
  }

  // (2) Domain yargısı — sıra, oda durumu, hücre.
  const verdict = judgeGridMove(room.state, input.userId, cell, input.now);
  if (verdict.kind === "ret") {
    throw new ValidationError(rejectionMessage(verdict.reason));
  }

  // (3) Cevabı sunucuda doğrula — ızgarayı tohumdan üret, iki ölçütle bak.
  const grid = await gridFor(room.state.config.seed, deps.grid);
  const rowCriterion = grid.rows[input.row];
  const columnCriterion = grid.columns[input.column];
  if (rowCriterion === undefined || columnCriterion === undefined) {
    // isCellRefInRange geçtiği için bu olmamalı; olursa üretim hatası.
    throw new GridUnavailableError();
  }
  const correct = await deps.grid.players.matchesAll(
    input.playerId as PlayerId,
    [rowCriterion, columnCriterion],
  );

  // (4) Yaz — moveIndex sıra numarası; kısıt tek turda iki hamleyi durdurur.
  const saved = await deps.rooms.saveMove({
    roomId: room.id,
    userId: input.userId,
    moveIndex: room.state.moves.length,
    cell,
    playerId: input.playerId,
    correct,
  });

  if (saved.kind === "cakisti") {
    // Yarışı kaybettik. Kendi hamlem yazıldıysa idempotan dön; yoksa sıra/hücre
    // az önce değişti — kullanıcı tazelemeli.
    const stored = myMoveAt(saved.room, input.userId, cell);
    if (stored !== undefined) {
      return {
        correct: stored.correct,
        room: await presentGrid(saved.room, input.userId, input.now, deps),
      };
    }
    throw new ValidationError(
      "Hamlen alınamadı: sıra ya da hücre az önce değişti. Tahtayı tazele.",
    );
  }

  return {
    correct,
    room: await presentGrid(saved.room, input.userId, input.now, deps),
  };
}

function rejectionMessage(reason: string): string {
  switch (reason) {
    case "sira-degil":
      return "Sıra sende değil: rakibin hamlesini bekle.";
    case "hucre-dolu":
      return "Bu hücre dolu.";
    case "gecersiz-hucre":
      return "Geçersiz hücre.";
    default:
      return "Bu oda şu an oynanmıyor.";
  }
}

/** İsteğin doğrulanması için sınır kelepçesi — hücre aralığı (§2.3). */
export function isGridCellInput(row: number, column: number): boolean {
  return isCellRefInRange({ row, column });
}
