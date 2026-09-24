import { beforeEach, describe, expect, it } from "vitest";
import type { RandomSource } from "@/application/ports/random-source";
import type {
  CreateGridRoomResult,
  GridRoomsRepository,
  JoinGridRoomResult,
  SaveGridMoveResult,
  StoredGridRoom,
} from "@/application/ports/grid-rooms-repository";
import {
  createGridRoom,
  getGridRoom,
  gridRoomConfigSchema,
  joinGridRoom,
  peekGridRoom,
  submitGridMove,
  type GridRoomDeps,
  type GridRoomDto,
} from "@/application/use-cases/grid-rooms";
import type { CellRef } from "@/domain/services/grid";
import type { GridRoomConfig } from "@/domain/services/grid-room";
import { isRoomCode } from "@/domain/value-objects/room-code";
import { gridFixture, type GridFixture } from "../../helpers/grid-fixture";

/**
 * §12.9 — Izgara odası (XOX) orkestrasyonu.
 *
 * Depolama değil KARAR ölçülüyor: ortak ızgara iki tarafta aynı mı, sıra
 * zorlanıyor mu (BR-72), yanlış hamle hücreyi öldürüp sırayı geçiriyor mu
 * (BR-73), galip nasıl kesinleşiyor (BR-75). Izgara üretimi `gridFixture` ile
 * gerçek `generateGrid`'i besler; tahta tamamı kulüp×kulüp olduğundan her
 * hücrenin doğru cevabı `playerAtBoth` ile bilinir.
 */

const SIMDI = new Date("2026-09-24T10:00:00.000Z");
const ileri = (dakika: number): Date =>
  new Date(SIMDI.getTime() + dakika * 60_000);

/** Bellek içi Izgara oda deposu — koltuk + iki hamle kısıtını uygular. */
class SahteGridOdaDeposu implements GridRoomsRepository {
  readonly odalar = new Map<string, StoredGridRoom>();
  silinenSahipler: string[] = [];
  silinenSonmusler = 0;

  findByCode(code: string): Promise<StoredGridRoom | null> {
    return Promise.resolve(this.odalar.get(code) ?? null);
  }

  createRoom(input: {
    readonly hostId: string;
    readonly code: string;
    readonly config: GridRoomConfig;
  }): Promise<CreateGridRoomResult> {
    if (this.odalar.has(input.code)) {
      return Promise.resolve({ kind: "kod-cakisti" });
    }
    const room: StoredGridRoom = {
      id: `oda-${input.code}`,
      code: input.code,
      hostId: input.hostId,
      state: {
        createdAt: SIMDI,
        startedAt: null,
        config: input.config,
        players: [{ userId: input.hostId, displayName: "EV" }],
        moves: [],
      },
    };
    this.odalar.set(input.code, room);
    return Promise.resolve({ kind: "kuruldu", room });
  }

  joinRoom(input: {
    readonly roomId: string;
    readonly userId: string;
    readonly startedAt: Date;
  }): Promise<JoinGridRoomResult> {
    const room = [...this.odalar.values()].find((r) => r.id === input.roomId);
    if (room === undefined) throw new Error("oda yok");
    if (room.state.players.length >= 2) {
      return Promise.resolve({ kind: "dolu" });
    }
    const guncel: StoredGridRoom = {
      ...room,
      state: {
        ...room.state,
        startedAt: input.startedAt,
        players: [
          ...room.state.players,
          { userId: input.userId, displayName: "KONUK" },
        ],
      },
    };
    this.odalar.set(room.code, guncel);
    return Promise.resolve({ kind: "katildi", room: guncel });
  }

  saveMove(input: {
    readonly roomId: string;
    readonly userId: string;
    readonly moveIndex: number;
    readonly cell: CellRef;
    readonly playerId: string;
    readonly correct: boolean;
  }): Promise<SaveGridMoveResult> {
    const room = [...this.odalar.values()].find((r) => r.id === input.roomId);
    if (room === undefined) throw new Error("oda yok");

    // KISITLAR — @@unique([roomId, moveIndex]) ve @@unique([roomId, row, col]).
    const clash = room.state.moves.some(
      (m) =>
        m.moveIndex === input.moveIndex ||
        (m.cell.row === input.cell.row && m.cell.column === input.cell.column),
    );
    if (clash) return Promise.resolve({ kind: "cakisti", room });

    const guncel: StoredGridRoom = {
      ...room,
      state: {
        ...room.state,
        moves: [
          ...room.state.moves,
          {
            moveIndex: input.moveIndex,
            userId: input.userId,
            cell: input.cell,
            playerId: input.playerId,
            correct: input.correct,
          },
        ],
      },
    };
    this.odalar.set(room.code, guncel);
    return Promise.resolve({ kind: "yazildi", room: guncel });
  }

  deleteHostedRooms(hostId: string): Promise<void> {
    this.silinenSahipler.push(hostId);
    return Promise.resolve();
  }

  deleteExpiredRooms(): Promise<number> {
    this.silinenSonmusler += 1;
    return Promise.resolve(0);
  }
}

/** Sırayla verilen baytları döner; bittiğinde başa sarar. */
class SahteRastgele implements RandomSource {
  private imlec = 0;
  constructor(
    private readonly kaynak: readonly number[] = [3, 11, 19, 2, 24, 8, 5, 14],
  ) {}
  bytes(count: number): Uint8Array {
    return Uint8Array.from({ length: count }, () => {
      const value = this.kaynak[this.imlec % this.kaynak.length] ?? 0;
      this.imlec += 1;
      return value;
    });
  }
}

let depo: SahteGridOdaDeposu;
let fixture: GridFixture;
let deps: GridRoomDeps;

beforeEach(() => {
  depo = new SahteGridOdaDeposu();
  fixture = gridFixture();
  deps = { rooms: depo, grid: fixture.deps, random: new SahteRastgele() };
});

/** Etiketten kulüp QID'ini çözer — fake etiketi `Kulüp <qid>`. */
function qidOf(label: string): string {
  return label.replace("Kulüp ", "");
}

/** Bir DTO'nun (r,c) hücresine DOĞRU cevap veren oyuncu kimliği. */
function correctPlayer(dto: GridRoomDto, row: number, column: number): string {
  const rowLabel = dto.rows[row]?.label ?? "";
  const colLabel = dto.columns[column]?.label ?? "";
  return fixture.playerAtBoth(qidOf(rowLabel), qidOf(colLabel));
}

/** Oda kur + ikinci oyuncu katıl; kodu döner. */
async function kurVeKatil(): Promise<string> {
  const kurulan = await createGridRoom({ now: SIMDI, userId: "ev" }, deps);
  await joinGridRoom(
    { now: ileri(1), userId: "konuk", code: kurulan.code },
    deps,
  );
  return kurulan.code;
}

/** Sırası gelen oyuncu — DTO'dan `yourTurn` ile bulunur. */
async function siradaki(
  code: string,
): Promise<{ userId: string; dto: GridRoomDto }> {
  const ev = await getGridRoom({ now: ileri(2), userId: "ev", code }, deps);
  if (ev.yourTurn) return { userId: "ev", dto: ev };
  const konuk = await getGridRoom(
    { now: ileri(2), userId: "konuk", code },
    deps,
  );
  return { userId: "konuk", dto: konuk };
}

describe("gridRoomConfigSchema (BR-71, §2.3)", () => {
  it("geçerli config'i ayrıştırır", () => {
    expect(gridRoomConfigSchema.parse({ seed: 42, firstSeat: 1 })).toEqual({
      seed: 42,
      firstSeat: 1,
    });
  });

  it("firstSeat 0/1 dışında ise reddeder", () => {
    expect(
      gridRoomConfigSchema.safeParse({ seed: 1, firstSeat: 2 }).success,
    ).toBe(false);
  });

  it("tohum tamsayı değilse reddeder", () => {
    expect(
      gridRoomConfigSchema.safeParse({ seed: 1.5, firstSeat: 0 }).success,
    ).toBe(false);
  });
});

describe("createGridRoom (§12.9, BR-71)", () => {
  it("geçerli kod üretir, boş 3×3 tahta, hedef gizli değil (ölçütler açık)", async () => {
    const oda = await createGridRoom({ now: SIMDI, userId: "ev" }, deps);

    expect(oda.mode).toBe("izgara");
    expect(isRoomCode(oda.code)).toBe(true);
    expect(oda.status).toBe("bekliyor");
    expect(oda.opponent).toBeNull();
    // Ortak ızgara ölçütleri kurucuya AÇIK (gizli hedef yok).
    expect(oda.rows).toHaveLength(3);
    expect(oda.columns).toHaveLength(3);
    // Tahta 3×3 ve tamamen boş.
    expect(oda.board).toHaveLength(3);
    expect(oda.board.every((row) => row.length === 3)).toBe(true);
    expect(oda.board.flat().every((cell) => cell.kind === "bos")).toBe(true);
    // Kurucunun işareti belli (X ya da O — firstSeat'e göre).
    expect(["X", "O"]).toContain(oda.me.mark);
  });

  it("kurucunun eski odalarını siler, sönmüşleri süpürür (BR-60)", async () => {
    await createGridRoom({ now: SIMDI, userId: "ev" }, deps);
    expect(depo.silinenSahipler).toEqual(["ev"]);
    expect(depo.silinenSonmusler).toBe(1);
  });
});

describe("katılma ve ortak ızgara (§12.9, BR-71)", () => {
  it("iki oyuncu AYNI ızgarayı ve zıt işaretleri görür", async () => {
    const code = await kurVeKatil();
    const ev = await getGridRoom({ now: ileri(2), userId: "ev", code }, deps);
    const konuk = await getGridRoom(
      { now: ileri(2), userId: "konuk", code },
      deps,
    );

    expect(ev.rows).toEqual(konuk.rows);
    expect(ev.columns).toEqual(konuk.columns);
    expect(ev.me.mark).not.toBe(konuk.me.mark);
    expect(ev.opponent?.mark).toBe(konuk.me.mark);
    // Tam olarak biri başlar.
    expect(ev.yourTurn).not.toBe(konuk.yourTurn);
  });

  it("üye olmayan getGridRoom çağıramaz", async () => {
    const code = await kurVeKatil();
    await expect(
      getGridRoom({ now: ileri(2), userId: "yabanci", code }, deps),
    ).rejects.toThrow(/üyesi değilsin/u);
  });

  it("peek: üyeye oda, yabancıya katılabilir/kapalı", async () => {
    const kurulan = await createGridRoom({ now: SIMDI, userId: "ev" }, deps);
    const konukPeek = await peekGridRoom(
      { now: ileri(1), userId: "konuk", code: kurulan.code },
      deps,
    );
    expect(konukPeek.kind).toBe("katilabilir");

    const evPeek = await peekGridRoom(
      { now: ileri(1), userId: "ev", code: kurulan.code },
      deps,
    );
    expect(evPeek.kind).toBe("uye");
  });
});

describe("sıra ve hamle (§12.9, BR-72/BR-73)", () => {
  it("sırası gelmeyen hamle yapamaz", async () => {
    const code = await kurVeKatil();
    const { userId } = await siradaki(code);
    const rakip = userId === "ev" ? "konuk" : "ev";

    await expect(
      submitGridMove(
        {
          now: ileri(2),
          userId: rakip,
          code,
          row: 0,
          column: 0,
          playerId: "x",
        },
        deps,
      ),
    ).rejects.toThrow(/Sıra sende değil/u);
  });

  it("doğru hamle hücreyi kapatır ve sıra rakibe geçer", async () => {
    const code = await kurVeKatil();
    const { userId, dto } = await siradaki(code);
    const player = correctPlayer(dto, 0, 0);

    const sonuc = await submitGridMove(
      { now: ileri(2), userId, code, row: 0, column: 0, playerId: player },
      deps,
    );

    expect(sonuc.correct).toBe(true);
    const cell = sonuc.room.board[0]?.[0];
    expect(cell?.kind).toBe("kapali");
    // Sıra artık bende değil.
    expect(sonuc.room.yourTurn).toBe(false);

    // Rakibin sırası açıldı.
    const next = await siradaki(code);
    expect(next.userId).not.toBe(userId);
  });

  it("yanlış hamle hücreyi ÖLDÜRÜR ama sırayı yine geçirir (BR-73)", async () => {
    const code = await kurVeKatil();
    const { userId } = await siradaki(code);

    const sonuc = await submitGridMove(
      {
        now: ileri(2),
        userId,
        code,
        row: 1,
        column: 1,
        playerId: "gecersiz-oyuncu",
      },
      deps,
    );

    expect(sonuc.correct).toBe(false);
    expect(sonuc.room.board[1]?.[1]?.kind).toBe("olu");
    // Ölü hücre de sırayı geçirir.
    const next = await siradaki(code);
    expect(next.userId).not.toBe(userId);
  });

  it("dolu hücreye hamle reddedilir", async () => {
    const code = await kurVeKatil();
    const ilk = await siradaki(code);
    await submitGridMove(
      {
        now: ileri(2),
        userId: ilk.userId,
        code,
        row: 0,
        column: 0,
        playerId: correctPlayer(ilk.dto, 0, 0),
      },
      deps,
    );

    // Sıra rakipte; rakip DOLU (0,0)'a basıyor.
    const ikinci = await siradaki(code);
    await expect(
      submitGridMove(
        {
          now: ileri(3),
          userId: ikinci.userId,
          code,
          row: 0,
          column: 0,
          playerId: "x",
        },
        deps,
      ),
    ).rejects.toThrow(/hücre dolu/u);
  });

  it("aynı hücreyi tekrar göndermek SAKLANANI döner (ağ tekrarı)", async () => {
    const code = await kurVeKatil();
    const { userId, dto } = await siradaki(code);
    const player = correctPlayer(dto, 0, 0);
    const move = {
      now: ileri(2),
      userId,
      code,
      row: 0,
      column: 0,
      playerId: player,
    };

    const ilk = await submitGridMove(move, deps);
    const tekrar = await submitGridMove(move, deps);
    expect(tekrar.correct).toBe(ilk.correct);
    // Tek hamle yazıldı: rakibin sırası (hamle sayısı 1).
    const room = await depo.findByCode(code);
    expect(room?.state.moves).toHaveLength(1);
  });
});

describe("galip (§12.9, BR-75)", () => {
  it("üst satırı dolduran oyuncu çizgiyle kazanır ve oyun biter", async () => {
    const code = await kurVeKatil();

    // İlk oyuncu (X) üst satırı doğru doldurur; rakip başka yere yanlış oynar.
    // Sıra tabanlı: X → O → X → O → X.
    const firstMover = await siradaki(code);
    const xUser = firstMover.userId;
    const oUser = xUser === "ev" ? "konuk" : "ev";
    const grid = firstMover.dto;

    // X (0,0) doğru
    await submitGridMove(
      {
        now: ileri(2),
        userId: xUser,
        code,
        row: 0,
        column: 0,
        playerId: correctPlayer(grid, 0, 0),
      },
      deps,
    );
    // O (1,0) yanlış (kaybetmesin diye başka yere)
    await submitGridMove(
      {
        now: ileri(3),
        userId: oUser,
        code,
        row: 1,
        column: 0,
        playerId: "yok",
      },
      deps,
    );
    // X (0,1) doğru
    await submitGridMove(
      {
        now: ileri(4),
        userId: xUser,
        code,
        row: 0,
        column: 1,
        playerId: correctPlayer(grid, 0, 1),
      },
      deps,
    );
    // O (1,1) yanlış
    await submitGridMove(
      {
        now: ileri(5),
        userId: oUser,
        code,
        row: 1,
        column: 1,
        playerId: "yok",
      },
      deps,
    );
    // X (0,2) doğru → üst satır tamam
    const sonHamle = await submitGridMove(
      {
        now: ileri(6),
        userId: xUser,
        code,
        row: 0,
        column: 2,
        playerId: correctPlayer(grid, 0, 2),
      },
      deps,
    );

    expect(sonHamle.room.status).toBe("bitti");
    expect(sonHamle.room.outcome).toBe("kazandin");
    expect(sonHamle.room.yourTurn).toBe(false);

    // Rakip için sonuç "kaybettin".
    const kaybeden = await getGridRoom(
      { now: ileri(7), userId: oUser, code },
      deps,
    );
    expect(kaybeden.outcome).toBe("kaybettin");

    // Biten maça hamle reddedilir.
    await expect(
      submitGridMove(
        {
          now: ileri(8),
          userId: oUser,
          code,
          row: 2,
          column: 2,
          playerId: "yok",
        },
        deps,
      ),
    ).rejects.toThrow(/oynanmıyor/u);
  });
});
