import type {
  CreateWhichMoreRoomResult,
  JoinWhichMoreRoomResult,
  SaveWhichMoreAnswerResult,
  StoredWhichMoreRoom,
  WhichMoreRoomsRepository,
} from "@/application/ports/which-more-rooms-repository";
import { whichMoreRoomConfigSchema } from "@/application/use-cases/which-more-rooms";
import type {
  WhichMoreDuelAnswer,
  WhichMoreRoomConfig,
  WhichMoreRoomPlayer,
} from "@/domain/services/which-more-room";
import { Prisma, type PrismaClient } from "@/generated/prisma-accounts";

/**
 * `WhichMoreRoomsRepository`'nin Prisma/Turso uygulaması — PROJECT.md §12.8.
 *
 * FİZİKSEL TABLOLARI İstatistik odasıyla PAYLAŞIR (`rooms`, `room_players`) ama
 * yalnızca `mode = "hangisi-daha"` odalarını okur/döner. Cevaplar ayrı tabloda
 * (`room_which_more_answers`). Yaşam döngüsü (koltuk, kod çakışması, sönme
 * temizliği) İstatistik deposuyla aynı desende; ortak SQL bir gün bir taban
 * sınıfa çıkarılabilir (şimdilik iki depo küçük ve okunur).
 *
 * Ham SQL YOK (§7.2): sorgu kurucusu kullanılıyor.
 */

/** Benzersizlik kısıtı ihlali — BR-54/BR-55/BR-58'in yarış kapısı. */
const UNIQUE_VIOLATION = "P2002";

/** BR-54 — 0 kurucu, 1 katılan. */
const HOST_SEAT = 0;
const GUEST_SEAT = 1;

/** §12.8 — bu depo yalnızca bu moddaki odaları okur/döner (BR-67). */
const WHICH_MORE_MODE = "hangisi-daha";

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_VIOLATION
  );
}

interface WhichMoreAnswerRow {
  readonly roundIndex: number;
  readonly chosenId: string;
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
    readonly whichMoreAnswers: readonly WhichMoreAnswerRow[];
  }[];
}

/** Cevap satırlarını, tur indeksine göre ARTAN sıralı domain cevaplarına çevirir. */
function toDuelAnswers(
  rows: readonly WhichMoreAnswerRow[],
): WhichMoreDuelAnswer[] {
  return [...rows]
    .sort((a, b) => a.roundIndex - b.roundIndex)
    .map((row) => ({
      roundIndex: row.roundIndex,
      chosenId: row.chosenId,
      correct: row.correct,
    }));
}

/**
 * Ham satırı `StoredWhichMoreRoom`'a çevirir; config geçersizse `null`.
 *
 * CONFIG SINIRDA DOĞRULANIR (§2.3). Bozuk/eksik config taşıyan bir oda
 * OYNANAMAZ; sessizce çökmek yerine `null` dönüp çağırana "böyle bir oda yok"
 * dedirtmek, hem güvenli (§6.3 sızıntı yok) hem de kullanıcıya tutarlı: zaten
 * o odayla oynanamaz.
 */
function toStoredRoom(row: RoomRow): StoredWhichMoreRoom | null {
  if (row.config === null) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(row.config);
  } catch {
    return null;
  }

  const parsed = whichMoreRoomConfigSchema.safeParse(raw);
  if (!parsed.success) return null;
  const config: WhichMoreRoomConfig = parsed.data;

  // KOLTUK NUMARASINA GÖRE SIRALA — sonuç ekranı iki tarafı hep aynı sırada
  // göstermeli (İstatistik deposuyla aynı gerekçe).
  const players: WhichMoreRoomPlayer[] = [...row.players]
    .sort((a, b) => a.seat - b.seat)
    .map((player) => ({
      userId: player.user.id,
      displayName: player.user.displayName,
      answers: toDuelAnswers(player.whichMoreAnswers),
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
      whichMoreAnswers: {
        select: { roundIndex: true, chosenId: true, correct: true },
      },
    },
  },
} as const;

export class PrismaWhichMoreRoomsRepository implements WhichMoreRoomsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByCode(code: string): Promise<StoredWhichMoreRoom | null> {
    // MODE SÜZGECİ (§12.8): yalnızca Hangisi Daha odaları. `findFirst` çünkü
    // artık iki koşul var (kod + mod).
    const row = await this.prisma.room.findFirst({
      where: { code, mode: WHICH_MORE_MODE },
      select: ROOM_SELECT,
    });

    return row === null ? null : toStoredRoom(row);
  }

  private async findById(id: string): Promise<StoredWhichMoreRoom | null> {
    const row = await this.prisma.room.findFirst({
      where: { id, mode: WHICH_MORE_MODE },
      select: ROOM_SELECT,
    });

    return row === null ? null : toStoredRoom(row);
  }

  async createRoom(input: {
    readonly hostId: string;
    readonly code: string;
    readonly config: WhichMoreRoomConfig;
  }): Promise<CreateWhichMoreRoomResult> {
    const roomId = crypto.randomUUID();

    try {
      // TEK İŞLEM: oda ve kurucunun koltuğu birlikte (İstatistik ile aynı
      // gerekçe — araya giren hata oyuncusuz oda bırakmasın).
      await this.prisma.$transaction(async (tx) => {
        await tx.room.create({
          data: {
            id: roomId,
            code: input.code,
            hostId: input.hostId,
            mode: WHICH_MORE_MODE,
            config: JSON.stringify(input.config),
            // `targetPlayerId` yok (BR-68 — hedef değil ray); `startedAt` yok (BR-57).
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
  }): Promise<JoinWhichMoreRoomResult> {
    try {
      // TEK İŞLEM: koltuk + başlangıç damgası birlikte (İstatistik ile aynı).
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

  async saveAnswer(input: {
    readonly roomId: string;
    readonly userId: string;
    readonly answer: WhichMoreDuelAnswer;
  }): Promise<SaveWhichMoreAnswerResult> {
    const seat = await this.prisma.roomPlayer.findUnique({
      where: {
        roomId_userId: { roomId: input.roomId, userId: input.userId },
      },
      select: { id: true },
    });

    if (seat === null) {
      throw new Error("Odada koltuğu olmayan için cevap yazılamaz (§12.2).");
    }

    try {
      // Kısıt ihlali BURADA doğar: aynı tur indeksi (BR-58 hattı) ikinci kez
      // yazılamaz.
      await this.prisma.roomWhichMoreAnswer.create({
        data: {
          id: crypto.randomUUID(),
          roomPlayerId: seat.id,
          roundIndex: input.answer.roundIndex,
          chosenId: input.answer.chosenId,
          correct: input.answer.correct,
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
    // MODA BAKILMAZ: kullanıcının HANGİ modda olursa olsun kurduğu oda düşer —
    // yeni oda kuran biri eskisini (ne modda olursa olsun) bırakmıştır.
    await this.prisma.room.deleteMany({ where: { hostId } });
  }

  async deleteExpiredRooms(cutoffs: {
    readonly unjoinedBefore: Date;
    readonly unfinishedBefore: Date;
  }): Promise<number> {
    // MODA BAKILMAZ — sönme kuralı (BR-60) oyundan bağımsız; iki mod da aynı
    // iki pencereyle söner. Süzgeç eklenseydi diğer modun sönmüş odaları
    // birikirdi.
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
