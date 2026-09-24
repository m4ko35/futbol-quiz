import type {
  CreateGridRoomResult,
  GridRoomsRepository,
  JoinGridRoomResult,
  SaveGridMoveResult,
  StoredGridRoom,
} from "@/application/ports/grid-rooms-repository";
import { gridRoomConfigSchema } from "@/application/use-cases/grid-rooms";
import type { CellRef } from "@/domain/services/grid";
import type {
  GridMove,
  GridRoomConfig,
  GridRoomPlayer,
} from "@/domain/services/grid-room";
import { Prisma, type PrismaClient } from "@/generated/prisma-accounts";

/**
 * `GridRoomsRepository`'nin Prisma/Turso uygulaması — PROJECT.md §12.9.
 *
 * FİZİKSEL TABLOLARI diğer oda modlarıyla PAYLAŞIR (`rooms`, `room_players`) ama
 * yalnızca `mode = "izgara"` odalarını okur/döner. Hamleler ayrı tabloda
 * (`room_grid_moves`) ve KOLTUĞA değil doğrudan ODAYA + KULLANICIYA bağlı
 * (oda-global sıra). Yaşam döngüsü (kod çakışması, koltuk, sönme temizliği) diğer
 * depolarla aynı desende.
 *
 * Ham SQL YOK (§7.2): sorgu kurucusu kullanılıyor.
 */

/** Benzersizlik kısıtı ihlali — kod/koltuk/hücre/sıra yarışının kapısı. */
const UNIQUE_VIOLATION = "P2002";

/** BR-54 — 0 kurucu, 1 katılan. */
const HOST_SEAT = 0;
const GUEST_SEAT = 1;

/** §12.9 — bu depo yalnızca bu moddaki odaları okur/döner (BR-71). */
const GRID_MODE = "izgara";

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_VIOLATION
  );
}

interface GridMoveRow {
  readonly moveIndex: number;
  readonly userId: string;
  readonly cellRow: number;
  readonly cellCol: number;
  readonly playerId: string;
  readonly correct: boolean;
}

interface RoomRow {
  readonly id: string;
  readonly code: string;
  readonly hostId: string;
  readonly config: string | null;
  readonly startedAt: Date | null;
  readonly createdAt: Date;
  readonly players: readonly {
    readonly seat: number;
    readonly user: { readonly id: string; readonly displayName: string };
  }[];
  readonly gridMoves: readonly GridMoveRow[];
}

/** Hamle satırlarını, sıra numarasına göre ARTAN sıralı domain hamlelerine çevirir. */
function toMoves(rows: readonly GridMoveRow[]): GridMove[] {
  return [...rows]
    .sort((a, b) => a.moveIndex - b.moveIndex)
    .map((row) => ({
      moveIndex: row.moveIndex,
      userId: row.userId,
      cell: { row: row.cellRow, column: row.cellCol },
      playerId: row.playerId,
      correct: row.correct,
    }));
}

/**
 * Ham satırı `StoredGridRoom`'a çevirir; config geçersizse `null`.
 *
 * CONFIG SINIRDA DOĞRULANIR (§2.3). Bozuk/eksik config taşıyan bir oda
 * OYNANAMAZ; sessizce çökmek yerine `null` dönüp çağırana "böyle bir oda yok"
 * dedirtmek hem güvenli (§6.3) hem tutarlı (which-more deposuyla aynı desen).
 */
function toStoredRoom(row: RoomRow): StoredGridRoom | null {
  if (row.config === null) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(row.config);
  } catch {
    return null;
  }

  const parsed = gridRoomConfigSchema.safeParse(raw);
  if (!parsed.success) return null;
  const config: GridRoomConfig = parsed.data;

  // KOLTUK NUMARASINA GÖRE SIRALA — 0 kurucu, 1 katılan; işaret (X/O) bu sıradan
  // türetilir (BR-76), o yüzden sıra her okumada aynı olmalı.
  const players: GridRoomPlayer[] = [...row.players]
    .sort((a, b) => a.seat - b.seat)
    .map((player) => ({
      userId: player.user.id,
      displayName: player.user.displayName,
    }));

  return {
    id: row.id,
    code: row.code,
    hostId: row.hostId,
    state: {
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      config,
      players,
      moves: toMoves(row.gridMoves),
    },
  };
}

/** Tek yerde tanımlı okuma şekli — bütün metotlar aynı odayı aynı biçimde okur. */
const ROOM_SELECT = {
  id: true,
  code: true,
  hostId: true,
  config: true,
  startedAt: true,
  createdAt: true,
  players: {
    select: {
      seat: true,
      user: { select: { id: true, displayName: true } },
    },
  },
  gridMoves: {
    select: {
      moveIndex: true,
      userId: true,
      cellRow: true,
      cellCol: true,
      playerId: true,
      correct: true,
    },
  },
} as const;

export class PrismaGridRoomsRepository implements GridRoomsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByCode(code: string): Promise<StoredGridRoom | null> {
    // MODE SÜZGECİ (§12.9): yalnızca Izgara odaları (BR-71).
    const row = await this.prisma.room.findFirst({
      where: { code, mode: GRID_MODE },
      select: ROOM_SELECT,
    });

    return row === null ? null : toStoredRoom(row);
  }

  private async findById(id: string): Promise<StoredGridRoom | null> {
    const row = await this.prisma.room.findFirst({
      where: { id, mode: GRID_MODE },
      select: ROOM_SELECT,
    });

    return row === null ? null : toStoredRoom(row);
  }

  async createRoom(input: {
    readonly hostId: string;
    readonly code: string;
    readonly config: GridRoomConfig;
  }): Promise<CreateGridRoomResult> {
    const roomId = crypto.randomUUID();

    try {
      // TEK İŞLEM: oda ve kurucunun koltuğu birlikte (araya giren hata oyuncusuz
      // oda bırakmasın).
      await this.prisma.$transaction(async (tx) => {
        await tx.room.create({
          data: {
            id: roomId,
            code: input.code,
            hostId: input.hostId,
            mode: GRID_MODE,
            config: JSON.stringify(input.config),
            // `targetPlayerId` yok (ızgara tohumdan üretilir); `startedAt` yok:
            // sıra ikinci oyuncu katılınca başlar (BR-72).
          },
        });

        await tx.roomPlayer.create({
          data: {
            id: crypto.randomUUID(),
            roomId,
            userId: input.hostId,
            seat: HOST_SEAT,
          },
        });
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) return { kind: "kod-cakisti" };
      throw error;
    }

    const room = await this.findById(roomId);
    if (room === null) throw new Error("Oda kuruldu ama okunamadı (§12.3).");

    return { kind: "kuruldu", room };
  }

  async joinRoom(input: {
    readonly roomId: string;
    readonly userId: string;
    readonly startedAt: Date;
  }): Promise<JoinGridRoomResult> {
    try {
      // TEK İŞLEM: koltuk + başlangıç damgası birlikte.
      await this.prisma.$transaction(async (tx) => {
        await tx.roomPlayer.create({
          data: {
            id: crypto.randomUUID(),
            roomId: input.roomId,
            userId: input.userId,
            seat: GUEST_SEAT,
          },
        });

        await tx.room.update({
          where: { id: input.roomId },
          data: { startedAt: input.startedAt },
        });
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) return { kind: "dolu" };
      throw error;
    }

    const room = await this.findById(input.roomId);
    if (room === null) {
      throw new Error("Odaya katılındı ama okunamadı (§12.3).");
    }

    return { kind: "katildi", room };
  }

  async saveMove(input: {
    readonly roomId: string;
    readonly userId: string;
    readonly moveIndex: number;
    readonly cell: CellRef;
    readonly playerId: string;
    readonly correct: boolean;
  }): Promise<SaveGridMoveResult> {
    try {
      // Kısıt ihlali BURADA doğar: aynı hücre (BR-73) ya da aynı sıra numarası
      // (BR-72) ikinci kez yazılamaz. Koltuk araması YOK — hamle doğrudan
      // odaya + kullanıcıya bağlı (which-more'un aksine).
      await this.prisma.roomGridMove.create({
        data: {
          id: crypto.randomUUID(),
          roomId: input.roomId,
          userId: input.userId,
          moveIndex: input.moveIndex,
          cellRow: input.cell.row,
          cellCol: input.cell.column,
          playerId: input.playerId,
          correct: input.correct,
        },
      });
    } catch (error: unknown) {
      if (!isUniqueViolation(error)) throw error;

      const existing = await this.findById(input.roomId);
      if (existing === null) throw error; // Olamaz; olursa gerçek bir hata.

      return { kind: "cakisti", room: existing };
    }

    const room = await this.findById(input.roomId);
    if (room === null) throw new Error("Hamle yazıldı ama oda okunamadı.");

    return { kind: "yazildi", room };
  }

  async deleteHostedRooms(hostId: string): Promise<void> {
    // MODA BAKILMAZ: kullanıcının hangi modda olursa olsun kurduğu oda düşer.
    await this.prisma.room.deleteMany({ where: { hostId } });
  }

  async deleteExpiredRooms(cutoffs: {
    readonly unjoinedBefore: Date;
    readonly unfinishedBefore: Date;
  }): Promise<number> {
    // MODA BAKILMAZ — sönme kuralı (BR-60) oyundan bağımsız.
    const result = await this.prisma.room.deleteMany({
      where: {
        OR: [
          { startedAt: null, createdAt: { lt: cutoffs.unjoinedBefore } },
          { startedAt: { lt: cutoffs.unfinishedBefore } },
        ],
      },
    });

    return result.count;
  }
}
