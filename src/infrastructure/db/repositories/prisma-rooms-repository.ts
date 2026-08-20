import type {
  CreateRoomResult,
  JoinRoomResult,
  RoomsRepository,
  SaveRoomAnswerResult,
  StoredRoom,
} from "@/application/ports/rooms-repository";
import type { RoundAnswer, RoundState } from "@/domain/services/daily-round";
import type { RoomPlayerState } from "@/domain/services/room";
import { isStatKey } from "@/domain/services/stat-match";
import { Prisma, type PrismaClient } from "@/generated/prisma-accounts";

/**
 * `RoomsRepository`'nin Prisma/Turso uygulaması — PROJECT.md §12.3.
 *
 * Ham SQL YOK (§7.2): sorgu kurucusu kullanılıyor.
 */

/** Benzersizlik kısıtı ihlali — BR-54/BR-55/BR-58'in yarış kapısı. */
const UNIQUE_VIOLATION = "P2002";

/** BR-54 — 0 kurucu, 1 katılan. */
const HOST_SEAT = 0;
const GUEST_SEAT = 1;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_VIOLATION
  );
}

interface AnswerRow {
  readonly statKey: string;
  readonly playerId: string;
  readonly value: number;
  readonly score: number;
}

/**
 * Satırlardan tur durumu.
 *
 * TANIMSIZ İSTATİSTİK ATLANIR — `prisma-accounts-repository.ts` ile aynı
 * gerekçe: `STAT_KEYS` bir gün değişirse eski satırlar tanınmayan bir anahtar
 * taşır ve o turu okunamaz kılmak yerine atlamak, oyunun devam etmesini
 * sağlar. Odada bedeli daha da düşük: oda sonucu hiçbir yerde saklanmıyor
 * (BR-60), yani geriye dönük bozulacak bir sıralama yok.
 */
function toRoundState(rows: readonly AnswerRow[]): RoundState {
  const answers: RoundAnswer[] = [];

  for (const row of rows) {
    if (!isStatKey(row.statKey)) continue;
    answers.push({
      statKey: row.statKey,
      playerId: row.playerId,
      value: row.value,
      score: row.score,
    });
  }

  return { answers };
}

interface RoomRow {
  readonly id: string;
  readonly code: string;
  readonly hostId: string;
  readonly targetPlayerId: string;
  readonly startedAt: Date | null;
  readonly createdAt: Date;
  readonly players: readonly {
    readonly seat: number;
    readonly user: { readonly id: string; readonly displayName: string };
    readonly answers: readonly AnswerRow[];
  }[];
}

function toStoredRoom(row: RoomRow): StoredRoom {
  /**
   * SIRALAMA KOLTUK NUMARASINA GÖRE ve bu bir süsleme değil: sonuç ekranı iki
   * tarafı hep aynı sırada göstermeli. `createdAt`'e göre sıralamak aynı
   * milisaniyede yazılmış iki satırda belirsiz kalırdı; koltuk numarası
   * kesindir ve hiç değişmez.
   */
  const players: RoomPlayerState[] = [...row.players]
    .sort((a, b) => a.seat - b.seat)
    .map((player) => ({
      userId: player.user.id,
      displayName: player.user.displayName,
      round: toRoundState(player.answers),
    }));

  return {
    id: row.id,
    code: row.code,
    hostId: row.hostId,
    targetPlayerId: row.targetPlayerId,
    state: {
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      players,
    },
  };
}

/** Tek yerde tanımlı okuma şekli — üç metot da aynı odayı aynı biçimde okur. */
const ROOM_SELECT = {
  id: true,
  code: true,
  hostId: true,
  targetPlayerId: true,
  startedAt: true,
  createdAt: true,
  players: {
    select: {
      seat: true,
      user: { select: { id: true, displayName: true } },
      answers: {
        select: { statKey: true, playerId: true, value: true, score: true },
      },
    },
  },
} as const;

export class PrismaRoomsRepository implements RoomsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByCode(code: string): Promise<StoredRoom | null> {
    const row = await this.prisma.room.findUnique({
      where: { code },
      select: ROOM_SELECT,
    });

    return row === null ? null : toStoredRoom(row);
  }

  private async findById(id: string): Promise<StoredRoom | null> {
    const row = await this.prisma.room.findUnique({
      where: { id },
      select: ROOM_SELECT,
    });

    return row === null ? null : toStoredRoom(row);
  }

  async createRoom(input: {
    readonly hostId: string;
    readonly code: string;
    readonly targetPlayerId: string;
  }): Promise<CreateRoomResult> {
    const roomId = crypto.randomUUID();

    try {
      // TEK İŞLEM: oda ve kurucunun koltuğu birlikte. Ayrı yazılsalardı araya
      // giren bir hata, kodu paylaşılmış ama içinde kimsenin olmadığı bir oda
      // bırakırdı.
      await this.prisma.$transaction(async (tx) => {
        await tx.room.create({
          data: {
            id: roomId,
            code: input.code,
            hostId: input.hostId,
            targetPlayerId: input.targetPlayerId,
            // `startedAt` yok — BR-57.
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
      // Kod çakıştı; çağıran yeni bir kodla dener (BR-55).
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
  }): Promise<JoinRoomResult> {
    try {
      /**
       * TEK İŞLEM: koltuk ve başlangıç damgası birlikte. Ayrı yazılsalardı
       * arada kalan sürede oda iki kişilik ama `startedAt`'siz olurdu — yani
       * `roomStatus` hâlâ "bekliyor" der ve hedef kimseye görünmezdi.
       */
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
      // İkinci koltuk kapılmış (BR-54) ya da bu kullanıcı zaten oturuyor.
      if (isUniqueViolation(error)) return { kind: "dolu" };
      throw error;
    }

    const room = await this.findById(input.roomId);
    if (room === null)
      throw new Error("Odaya katılındı ama okunamadı (§12.3).");

    return { kind: "katildi", room };
  }

  async saveAnswer(input: {
    readonly roomId: string;
    readonly userId: string;
    readonly answer: RoundAnswer;
  }): Promise<SaveRoomAnswerResult> {
    const seat = await this.prisma.roomPlayer.findUnique({
      where: {
        roomId_userId: { roomId: input.roomId, userId: input.userId },
      },
      select: { id: true },
    });

    // Üye olmayanın cevabı buraya HİÇ gelmemeli; kararı çağıran verdi.
    if (seat === null) {
      throw new Error("Odada koltuğu olmayan için cevap yazılamaz (§12.2).");
    }

    try {
      // Kısıt ihlali BURADA doğar: aynı istatistik (BR-58) ya da aynı oyuncu
      // (BR-17'nin oda karşılığı) ikinci kez yazılamaz.
      await this.prisma.roomAnswer.create({
        data: {
          id: crypto.randomUUID(),
          roomPlayerId: seat.id,
          statKey: input.answer.statKey,
          playerId: input.answer.playerId,
          value: input.answer.value,
          score: input.answer.score,
        },
      });
    } catch (error: unknown) {
      if (!isUniqueViolation(error)) throw error;

      const existing = await this.findById(input.roomId);
      if (existing === null) throw error; // Olamaz; olursa gerçek bir hata.

      return { kind: "zaten-var", room: existing };
    }

    const room = await this.findById(input.roomId);
    if (room === null) throw new Error("Cevap yazıldı ama oda okunamadı.");

    return { kind: "yazildi", room };
  }

  async deleteHostedRooms(hostId: string): Promise<void> {
    await this.prisma.room.deleteMany({ where: { hostId } });
  }

  async deleteExpiredRooms(cutoffs: {
    readonly unjoinedBefore: Date;
    readonly unfinishedBefore: Date;
  }): Promise<number> {
    /**
     * İKİ PENCERE, İKİ KOŞUL — BR-60. Eşikler çağırandan geliyor; süreleri
     * burada ikinci kez yazmak, bir gün birinin yalnızca birini değiştirmesi
     * demekti (§12.3).
     *
     * BİTMİŞ ODA DA SİLİNİR ve bu `roomStatus` ile ÇELİŞMEZ. Orada bitmişlik
     * saatten önce gelir çünkü oynanıp bitmiş bir turun sonucu, süre doldu
     * diye kaybolmamalı. Burada oda tamamen ortadan kalkıyor — BR-60'ın
     * "sonuç hiçbir yerde birikmez" kuralının ta kendisi. Sonucu iki taraf da
     * bittiği anda görüyor; bir saat sonra sayfayı yenileyen "oda bulunamadı"
     * görür ve doğrusu budur.
     */
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
