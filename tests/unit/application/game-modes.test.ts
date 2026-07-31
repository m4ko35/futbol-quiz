import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  COMMON_PLAYERS_MODE_ID,
  commonPlayersMode,
} from "@/application/game-modes/common-players";
import { gameModes } from "@/application/game-modes";
import { GRID_MODE_ID, gridInputSchema } from "@/application/game-modes/grid";
import {
  defineGameMode,
  GameModeRegistry,
} from "@/application/game-modes/registry";
import type { GameModeDeps } from "@/application/game-modes/types";
import { ValidationError } from "@/domain/errors/domain-error";
import { clubId } from "@/domain/value-objects/identifiers";
import { aClub, aPlayer, aSpell } from "../../helpers/builders";
import {
  FakeClubRepository,
  FakePlayerRepository,
  FakeStatMatchRepository,
} from "../../helpers/fake-repositories";

/** §9 — oyun modu sözleşmesi. */

const CLUB_A = clubId("clubA");
const CLUB_B = clubId("clubB");

function deps(): GameModeDeps {
  return {
    clubs: new FakeClubRepository([
      aClub({ id: CLUB_A, shortName: "Galatasaray" }),
      aClub({ id: CLUB_B, shortName: "Arsenal" }),
    ]),
    players: new FakePlayerRepository([
      {
        player: aPlayer({ name: "Ortak" }),
        spells: [aSpell({ clubId: CLUB_A }), aSpell({ clubId: CLUB_B })],
      },
    ]),
    statMatch: new FakeStatMatchRepository(),
  };
}

describe("GameModeRegistry", () => {
  it("kayıtlı modu kimliğiyle bulur", () => {
    const registry = new GameModeRegistry();
    registry.register(commonPlayersMode);

    expect(registry.get(COMMON_PLAYERS_MODE_ID)?.title).toBe("Ortak Oyuncu");
  });

  it("bilinmeyen kimlik için undefined döner", () => {
    expect(new GameModeRegistry().get("yok")).toBeUndefined();
  });

  it("aynı kimlik iki kez kaydedilemez", () => {
    // Sessiz üzerine yazma, hangi modun çalıştığını rastgele yapardı —
    // testlerde görünmeyip yalnızca üretimde ortaya çıkan bir hata sınıfı.
    const registry = new GameModeRegistry();
    registry.register(commonPlayersMode);

    expect(() => {
      registry.register(commonPlayersMode);
    }).toThrow(/zaten kayıtlı/u);
  });

  it("MVP modu varsayılan kayıt defterinde hazırdır", () => {
    expect(gameModes.list().map((m) => m.id)).toContain(COMMON_PLAYERS_MODE_ID);
  });

  it("ızgara modu varsayılan kayıt defterinde hazırdır", () => {
    expect(gameModes.list().map((m) => m.id)).toContain(GRID_MODE_ID);
  });
});

/**
 * §9.1 — ızgaranın iki eylemi tek modda, ayırt edici birleşimle taşınıyor.
 * Sözleşme tek `execute` tanımlar; komut kümesini modun kendi şeması tarif eder.
 */
describe("gridInputSchema — ayırt edici birleşim", () => {
  it("günlük ızgara isteğini kabul eder", () => {
    expect(gridInputSchema.safeParse({ action: "daily" }).success).toBe(true);
  });

  it("cevap isteğini kabul eder", () => {
    const parsed = gridInputSchema.safeParse({
      action: "answer",
      cell: { row: 1, column: 2 },
      playerId: "abc123",
    });

    expect(parsed.success).toBe(true);
  });

  it.each([
    ["bilinmeyen eylem", { action: "hile" }],
    ["eylem yok", { cell: { row: 0, column: 0 }, playerId: "a" }],
    [
      "aralık dışı satır",
      { action: "answer", cell: { row: 3, column: 0 }, playerId: "a" },
    ],
    [
      "negatif sütun",
      { action: "answer", cell: { row: 0, column: -1 }, playerId: "a" },
    ],
    [
      "tam sayı olmayan hücre",
      { action: "answer", cell: { row: 0.5, column: 0 }, playerId: "a" },
    ],
    [
      "geçersiz kimlik biçimi",
      { action: "answer", cell: { row: 0, column: 0 }, playerId: "a b" },
    ],
    ["hücresiz cevap", { action: "answer", playerId: "a" }],
  ])("geçersiz girdiyi (%s) reddeder", (_label, raw) => {
    expect(gridInputSchema.safeParse(raw).success).toBe(false);
  });

  /**
   * Girdide TARİH ALANI YOK. Olsaydı istemci yarının ızgarasını bugünden
   * çekebilir ya da geçmiş bir günü tekrar oynayabilirdi; gün sunucunun saati.
   */
  it("tarih alanı girdiye taşınmaz", () => {
    const parsed = gridInputSchema.safeParse({
      action: "daily",
      date: "2020-01-01",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ action: "daily" });
  });
});

describe("defineGameMode — sınırda doğrulama (§2.3)", () => {
  it("geçerli girdiyi ayrıştırıp execute'a iletir", async () => {
    const result = await commonPlayersMode.run(
      { clubA: CLUB_A, clubB: CLUB_B },
      deps(),
    );

    expect(result).toMatchObject({ count: 1 });
  });

  it("varsayılanları şemadan uygular", async () => {
    // includeYouth/includeLoans verilmedi; şema varsayılanı doldurmalı.
    const result = await commonPlayersMode.run(
      { clubA: CLUB_A, clubB: CLUB_B },
      deps(),
    );

    expect(result).toMatchObject({ count: 1 });
  });

  it.each([
    ["eksik alan", { clubA: CLUB_A }],
    ["yanlış tip", { clubA: 1, clubB: 2 }],
    ["geçersiz kimlik biçimi", { clubA: "a b", clubB: CLUB_B }],
    ["null", null],
    ["dizi", []],
  ])("geçersiz girdi (%s) ValidationError üretir", async (_label, raw) => {
    await expect(commonPlayersMode.run(raw, deps())).rejects.toThrow(
      ValidationError,
    );
  });

  it("hata mesajı ayrıştırıcının iç ayrıntısını SIZDIRMAZ", async () => {
    // Zod'un hata ağacı alan yollarını ve gelen değerleri içerir; bunlar iç
    // yapıyı açık eder ve yanıta girmemelidir (§6.3).
    const thrown: unknown = await commonPlayersMode
      .run({ clubA: "geçersiz kimlik", clubB: CLUB_B }, deps())
      .catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(ValidationError);
    const error = thrown as ValidationError;
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).not.toMatch(/clubA|zod|invalid_|expected/iu);
  });

  it("modun kendi şeması dışındaki alanları execute'a taşımaz", async () => {
    const captured: unknown[] = [];
    const mode = defineGameMode({
      id: "test",
      title: "Test",
      inputSchema: z.object({ a: z.string() }),
      execute(input) {
        captured.push(input);
        return Promise.resolve(null);
      },
    });

    await mode.run({ a: "x", tehlikeli: "y" }, deps());

    expect(captured[0]).toEqual({ a: "x" });
  });
});
