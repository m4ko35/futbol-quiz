import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaRoomsRepository } from "@/infrastructure/db/repositories/prisma-rooms-repository";
import { PrismaWhichMoreRoomsRepository } from "@/infrastructure/db/repositories/prisma-which-more-rooms-repository";
import type { WhichMoreRoomConfig } from "@/domain/services/which-more-room";
import {
  createAccountsDatabase,
  type AccountsTestDatabase,
} from "../helpers/accounts-database";

/**
 * Hangisi Daha oda deposunun port sözleşmesini GERÇEK şemayla ölçer (§8.1,
 * §12.8). Yerel SQLite Turso ile uyumludur; göç SQL'i, kısıtlar ve mod
 * ayrımı burada kanıtlanır. Turso'da da tuttuğu ayrıca `db:verify:accounts`
 * ile sayılır (§12.3).
 */

let db: AccountsTestDatabase;
let repo: PrismaWhichMoreRoomsRepository;
let statRepo: PrismaRoomsRepository;

const CONFIG: WhichMoreRoomConfig = {
  submode: "ani-olum",
  statKey: "goals",
  level: "easy",
  direction: "more",
  seed: 42,
};

async function newUser(id: string): Promise<void> {
  await db.prisma.user.create({
    data: {
      id,
      subjectHash: `ozet-${id}`,
      displayName: id.toUpperCase(),
      displayNameKey: id,
    },
  });
}

beforeAll(() => {
  db = createAccountsDatabase();
  repo = new PrismaWhichMoreRoomsRepository(db.prisma);
  statRepo = new PrismaRoomsRepository(db.prisma);
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  await db.prisma.user.deleteMany();
});

describe("createRoom / findByCode (§12.8, BR-67/BR-68)", () => {
  it("odayı kurar, config'i JSON olarak saklar ve geri okur", async () => {
    await newUser("ev");
    const created = await repo.createRoom({
      hostId: "ev",
      code: "BCDFGH",
      config: CONFIG,
    });
    expect(created.kind).toBe("kuruldu");
    if (created.kind !== "kuruldu") return;

    const room = await repo.findByCode("BCDFGH");
    expect(room).not.toBeNull();
    expect(room?.state.config).toEqual(CONFIG);
    expect(room?.state.startedAt).toBeNull(); // BR-57
    expect(room?.state.players).toHaveLength(1);
    expect(room?.state.players[0]?.userId).toBe("ev");
  });

  it("aynı kod ikinci kez kod-cakisti döner (BR-55)", async () => {
    await newUser("ev");
    await newUser("ev2");
    await repo.createRoom({ hostId: "ev", code: "BCDFGH", config: CONFIG });

    const ikinci = await repo.createRoom({
      hostId: "ev2",
      code: "BCDFGH",
      config: CONFIG,
    });
    expect(ikinci.kind).toBe("kod-cakisti");
  });

  it("bozuk config taşıyan oda okunamaz (null) — sınır doğrulaması (§2.3)", async () => {
    await newUser("ev");
    await db.prisma.room.create({
      data: {
        id: "bozuk",
        code: "JKMNPR",
        hostId: "ev",
        mode: "hangisi-daha",
        config: "{ bu json degil",
      },
    });
    expect(await repo.findByCode("JKMNPR")).toBeNull();
  });
});

describe("join / saveAnswer (§12.8, BR-68/BR-70)", () => {
  async function kurVeKatil(): Promise<string> {
    await newUser("ev");
    await newUser("konuk");
    const created = await repo.createRoom({
      hostId: "ev",
      code: "BCDFGH",
      config: CONFIG,
    });
    if (created.kind !== "kuruldu") throw new Error("kurulamadi");
    const joined = await repo.joinRoom({
      roomId: created.room.id,
      userId: "konuk",
      startedAt: new Date("2026-09-23T10:01:00Z"),
    });
    if (joined.kind !== "katildi") throw new Error("katilinamadi");
    return created.room.id;
  }

  it("ikinci oyuncu katılır ve tur başlar (startedAt yazılır)", async () => {
    await kurVeKatil();
    const room = await repo.findByCode("BCDFGH");
    expect(room?.state.players).toHaveLength(2);
    expect(room?.state.startedAt).not.toBeNull();
  });

  it("düello cevabı yazılır ve tur indeksine göre sıralı okunur", async () => {
    const roomId = await kurVeKatil();

    await repo.saveAnswer({
      roomId,
      userId: "ev",
      answer: { roundIndex: 0, chosenId: "p0", correct: true },
    });
    await repo.saveAnswer({
      roomId,
      userId: "ev",
      answer: { roundIndex: 1, chosenId: "p1", correct: false },
    });

    const room = await repo.findByCode("BCDFGH");
    const me = room?.state.players.find((p) => p.userId === "ev");
    expect(me?.answers).toEqual([
      { roundIndex: 0, chosenId: "p0", correct: true },
      { roundIndex: 1, chosenId: "p1", correct: false },
    ]);
  });

  it("aynı tur indeksi ikinci kez zaten-var döner (BR-58 hattı — KISIT)", async () => {
    const roomId = await kurVeKatil();
    await repo.saveAnswer({
      roomId,
      userId: "ev",
      answer: { roundIndex: 0, chosenId: "p0", correct: true },
    });

    const ikinci = await repo.saveAnswer({
      roomId,
      userId: "ev",
      answer: { roundIndex: 0, chosenId: "p9", correct: false },
    });
    expect(ikinci.kind).toBe("zaten-var");

    // Saklanan korunur — ikinci yazım üzerine yazmaz.
    const room = await repo.findByCode("BCDFGH");
    const me = room?.state.players.find((p) => p.userId === "ev");
    expect(me?.answers).toEqual([
      { roundIndex: 0, chosenId: "p0", correct: true },
    ]);
  });
});

describe("mod ayrımı — paylaşılan tablolar (§12.8)", () => {
  it("Hangisi Daha deposu bir İstatistik odasını GÖRMEZ ve tersi", async () => {
    await newUser("ev");
    await newUser("ev2");

    await repo.createRoom({ hostId: "ev", code: "BCDFGH", config: CONFIG });
    await statRepo.createRoom({
      hostId: "ev2",
      code: "JKMNPR",
      targetPlayerId: "hedef-1",
    });

    // Her depo yalnızca kendi modundaki odayı okur.
    expect(await repo.findByCode("JKMNPR")).toBeNull();
    expect(await statRepo.findByCode("BCDFGH")).toBeNull();

    expect(await repo.findByCode("BCDFGH")).not.toBeNull();
    expect(await statRepo.findByCode("JKMNPR")).not.toBeNull();
  });
});

describe("temizlik (§12.8, BR-60)", () => {
  it("deleteHostedRooms kurucunun odasını siler", async () => {
    await newUser("ev");
    await repo.createRoom({ hostId: "ev", code: "BCDFGH", config: CONFIG });

    await repo.deleteHostedRooms("ev");
    expect(await repo.findByCode("BCDFGH")).toBeNull();
  });

  it("deleteExpiredRooms başlamamış eski odayı süpürür", async () => {
    await newUser("ev");
    // createdAt'i elle eskiye çekmek için doğrudan yaz.
    await db.prisma.room.create({
      data: {
        id: "eski",
        code: "BCDFGH",
        hostId: "ev",
        mode: "hangisi-daha",
        config: JSON.stringify(CONFIG),
        createdAt: new Date("2026-09-23T09:00:00Z"),
      },
    });

    const silinen = await repo.deleteExpiredRooms({
      unjoinedBefore: new Date("2026-09-23T09:30:00Z"),
      unfinishedBefore: new Date("2026-09-23T08:00:00Z"),
    });
    expect(silinen).toBe(1);
    expect(await repo.findByCode("BCDFGH")).toBeNull();
  });
});
