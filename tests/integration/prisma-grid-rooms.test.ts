import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaGridRoomsRepository } from "@/infrastructure/db/repositories/prisma-grid-rooms-repository";
import { PrismaRoomsRepository } from "@/infrastructure/db/repositories/prisma-rooms-repository";
import type { GridRoomConfig } from "@/domain/services/grid-room";
import {
  createAccountsDatabase,
  type AccountsTestDatabase,
} from "../helpers/accounts-database";

/**
 * Izgara (XOX) oda deposunun port sözleşmesini GERÇEK şemayla ölçer (§8.1,
 * §12.9). Yerel SQLite Turso ile uyumludur; göç SQL'i ve İKİ oda-kapsamlı
 * kısıt (bir hücre bir kez, bir sıra numarası bir kez) burada kanıtlanır.
 * Turso'da da tuttuğu ayrıca `db:verify:accounts` ile sayılır (§12.3).
 */

let db: AccountsTestDatabase;
let repo: PrismaGridRoomsRepository;
let statRepo: PrismaRoomsRepository;

const CONFIG: GridRoomConfig = { seed: 42, firstSeat: 0 };

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

async function kurVeKatil(code = "BCDFGH"): Promise<string> {
  await newUser("ev");
  await newUser("konuk");
  const created = await repo.createRoom({ hostId: "ev", code, config: CONFIG });
  if (created.kind !== "kuruldu") throw new Error("kurulamadi");
  const joined = await repo.joinRoom({
    roomId: created.room.id,
    userId: "konuk",
    startedAt: new Date("2026-09-24T10:01:00Z"),
  });
  if (joined.kind !== "katildi") throw new Error("katilinamadi");
  return created.room.id;
}

beforeAll(() => {
  db = createAccountsDatabase();
  repo = new PrismaGridRoomsRepository(db.prisma);
  statRepo = new PrismaRoomsRepository(db.prisma);
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  await db.prisma.user.deleteMany();
});

describe("createRoom / findByCode (§12.9, BR-71)", () => {
  it("odayı kurar, config'i JSON olarak saklar ve geri okur", async () => {
    await newUser("ev");
    const created = await repo.createRoom({
      hostId: "ev",
      code: "BCDFGH",
      config: CONFIG,
    });
    expect(created.kind).toBe("kuruldu");

    const room = await repo.findByCode("BCDFGH");
    expect(room?.state.config).toEqual(CONFIG);
    expect(room?.state.startedAt).toBeNull(); // sıra katılınca başlar (BR-72)
    expect(room?.state.players).toHaveLength(1);
    expect(room?.state.players[0]?.userId).toBe("ev");
    expect(room?.state.moves).toHaveLength(0);
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
        mode: "izgara",
        config: "{ bu json degil",
      },
    });
    expect(await repo.findByCode("JKMNPR")).toBeNull();
  });
});

describe("join / saveMove (§12.9, BR-72/BR-73)", () => {
  it("ikinci oyuncu katılır ve sıra başlar (startedAt yazılır)", async () => {
    await kurVeKatil();
    const room = await repo.findByCode("BCDFGH");
    expect(room?.state.players).toHaveLength(2);
    expect(room?.state.startedAt).not.toBeNull();
  });

  it("hamle yazılır ve sıra numarasına göre sıralı okunur", async () => {
    const roomId = await kurVeKatil();

    await repo.saveMove({
      roomId,
      userId: "ev",
      moveIndex: 0,
      cell: { row: 0, column: 0 },
      playerId: "p0",
      correct: true,
    });
    await repo.saveMove({
      roomId,
      userId: "konuk",
      moveIndex: 1,
      cell: { row: 1, column: 2 },
      playerId: "p1",
      correct: false,
    });

    const room = await repo.findByCode("BCDFGH");
    expect(room?.state.moves).toEqual([
      {
        moveIndex: 0,
        userId: "ev",
        cell: { row: 0, column: 0 },
        playerId: "p0",
        correct: true,
      },
      {
        moveIndex: 1,
        userId: "konuk",
        cell: { row: 1, column: 2 },
        playerId: "p1",
        correct: false,
      },
    ]);
  });

  it("aynı HÜCREYE ikinci hamle cakisti döner (BR-73 — KISIT)", async () => {
    const roomId = await kurVeKatil();
    await repo.saveMove({
      roomId,
      userId: "ev",
      moveIndex: 0,
      cell: { row: 0, column: 0 },
      playerId: "p0",
      correct: true,
    });

    // Farklı sıra numarası ama AYNI hücre → hücre kısıtı çiğnenir.
    const ikinci = await repo.saveMove({
      roomId,
      userId: "konuk",
      moveIndex: 1,
      cell: { row: 0, column: 0 },
      playerId: "p9",
      correct: false,
    });
    expect(ikinci.kind).toBe("cakisti");

    // İlk hamle korunur.
    const room = await repo.findByCode("BCDFGH");
    expect(room?.state.moves).toHaveLength(1);
  });

  it("aynı SIRA NUMARASINA ikinci hamle cakisti döner (BR-72 — KISIT)", async () => {
    const roomId = await kurVeKatil();
    await repo.saveMove({
      roomId,
      userId: "ev",
      moveIndex: 0,
      cell: { row: 0, column: 0 },
      playerId: "p0",
      correct: true,
    });

    // Farklı hücre ama AYNI sıra numarası → tek turda iki hamle yarışı durur.
    const ikinci = await repo.saveMove({
      roomId,
      userId: "konuk",
      moveIndex: 0,
      cell: { row: 1, column: 1 },
      playerId: "p9",
      correct: false,
    });
    expect(ikinci.kind).toBe("cakisti");

    const room = await repo.findByCode("BCDFGH");
    expect(room?.state.moves).toHaveLength(1);
  });
});

describe("mod ayrımı — paylaşılan tablolar (§12.9)", () => {
  it("Izgara deposu bir İstatistik odasını GÖRMEZ ve tersi", async () => {
    await newUser("ev");
    await newUser("ev2");

    await repo.createRoom({ hostId: "ev", code: "BCDFGH", config: CONFIG });
    await statRepo.createRoom({
      hostId: "ev2",
      code: "JKMNPR",
      targetPlayerId: "hedef-1",
    });

    expect(await repo.findByCode("JKMNPR")).toBeNull();
    expect(await statRepo.findByCode("BCDFGH")).toBeNull();

    expect(await repo.findByCode("BCDFGH")).not.toBeNull();
    expect(await statRepo.findByCode("JKMNPR")).not.toBeNull();
  });
});

describe("temizlik (§12.9, BR-60)", () => {
  it("deleteHostedRooms kurucunun odasını (ve hamlelerini) siler", async () => {
    const roomId = await kurVeKatil();
    await repo.saveMove({
      roomId,
      userId: "ev",
      moveIndex: 0,
      cell: { row: 0, column: 0 },
      playerId: "p0",
      correct: true,
    });

    await repo.deleteHostedRooms("ev");
    expect(await repo.findByCode("BCDFGH")).toBeNull();
    // Hamleler oda ile birlikte cascade silinir.
    expect(await db.prisma.roomGridMove.count()).toBe(0);
  });

  it("deleteExpiredRooms başlamamış eski odayı süpürür", async () => {
    await newUser("ev");
    await db.prisma.room.create({
      data: {
        id: "eski",
        code: "BCDFGH",
        hostId: "ev",
        mode: "izgara",
        config: JSON.stringify(CONFIG),
        createdAt: new Date("2026-09-24T09:00:00Z"),
      },
    });

    const silinen = await repo.deleteExpiredRooms({
      unjoinedBefore: new Date("2026-09-24T09:30:00Z"),
      unfinishedBefore: new Date("2026-09-24T08:00:00Z"),
    });
    expect(silinen).toBe(1);
    expect(await repo.findByCode("BCDFGH")).toBeNull();
  });
});
