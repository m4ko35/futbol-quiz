import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateGrid } from "@/application/game-modes/grid/generate";
import {
  GRID_SIZE,
  isCellPlayable,
  isGridShapeValid,
} from "@/domain/services/grid";
import { dailySeed } from "@/domain/value-objects/daily-seed";
import { playerId } from "@/domain/value-objects/identifiers";
import { gridFixture, type GridFixture } from "../../helpers/grid-fixture";
import {
  FakeClubRepository,
  FakePlayerRepository,
} from "../../helpers/fake-repositories";

/** §9.1 — günlük ızgara use-case'i (BR-9…BR-12). */

const DAY = new Date("2026-07-31T09:00:00Z");
const OTHER_DAY = new Date("2026-08-05T09:00:00Z");

/**
 * `daily-grid` modülü gün bazlı bir önbellek tutar.
 *
 * Her test kendi modül örneğini alır; aksi hâlde bir testin ürettiği ızgara
 * diğerinin sonucunu belirlerdi ve testler birbirine görünmez biçimde bağlı
 * olurdu.
 *
 * HATA SINIFLARI DA BURADAN GELİR. `resetModules` tüm modül grafiğini yeniden
 * yükler; dosyanın üstünde statik olarak alınmış bir `ValidationError`, taze
 * grafikte üretilen hatadan FARKLI bir sınıf olurdu ve `instanceof` yanlış
 * yere `false` verirdi — testi kıran ama kodda hiçbir kusur olmayan bir durum.
 */
async function loadUseCase() {
  vi.resetModules();
  const [useCase, errors] = await Promise.all([
    import("@/application/use-cases/daily-grid"),
    import("@/domain/errors/domain-error"),
  ]);
  return { ...useCase, ...errors };
}

describe("generateGrid — §9.1", () => {
  let fixture: GridFixture;

  beforeEach(() => {
    fixture = gridFixture();
  });

  it("yapısal olarak geçerli bir ızgara üretir", async () => {
    const grid = await generateGrid(dailySeed(DAY), fixture.deps);

    expect(grid).not.toBeNull();
    expect(isGridShapeValid(grid!)).toBe(true);
  });

  it("her hücre BR-9 bandının içindedir", async () => {
    const grid = await generateGrid(dailySeed(DAY), fixture.deps);
    expect(grid).not.toBeNull();

    const sets = await Promise.all(
      [...grid!.rows, ...grid!.columns].map(
        async (criterion) =>
          new Set(await fixture.deps.players.findIdsMatching(criterion)),
      ),
    );

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let column = 0; column < GRID_SIZE; column++) {
        const rowSet = sets[row];
        const columnSet = sets[GRID_SIZE + column];
        expect(rowSet).toBeDefined();
        expect(columnSet).toBeDefined();

        let count = 0;
        for (const id of rowSet!) if (columnSet!.has(id)) count++;
        expect(isCellPlayable(count)).toBe(true);
      }
    }
  });

  it("aynı tohum aynı ızgarayı verir (BR-11)", async () => {
    const first = await generateGrid(20260731, fixture.deps);
    const second = await generateGrid(20260731, gridFixture().deps);

    expect(first).toEqual(second);
  });

  /**
   * Havuz üç sütun + en az bir satır adayı isteyecek kadar büyük olmalı.
   * Küçükse sessizce bozuk bir ızgara üretmek yerine `null` dönmelidir (§2.7).
   */
  it("havuz yetersizse null döner", async () => {
    const empty = {
      clubs: new FakeClubRepository([]),
      players: new FakePlayerRepository([]),
    };

    expect(await generateGrid(20260731, empty)).toBeNull();
  });

  it("kriter kümesi üretim boyunca YENİDEN sorgulanmaz", async () => {
    await generateGrid(dailySeed(DAY), fixture.deps);

    // Havuzda 6 kulüp + 30 ülke kodu var; her kriter için EN FAZLA bir sorgu.
    expect(fixture.callCount()).toBeLessThanOrEqual(36);
  });
});

describe("getDailyGrid", () => {
  it("üç satır ve üç sütun döner", async () => {
    const { getDailyGrid } = await loadUseCase();
    const dto = await getDailyGrid(DAY, gridFixture().deps);

    expect(dto.rows).toHaveLength(GRID_SIZE);
    expect(dto.columns).toHaveLength(GRID_SIZE);
    expect(dto.date).toBe("2026-07-31");
  });

  /**
   * SIZINTI KURALI (§9.1): yanıt cevapları taşımaz ve hücre başına cevap
   * SAYISINI da taşımaz — sayı, tahmin alanını daraltan bir ipucudur.
   * Kriterin kimliği (kulüp kimliği, ülke kodu) de dışarı çıkmaz.
   */
  it("kriterlerden başka hiçbir alan sızdırmaz", async () => {
    const { getDailyGrid } = await loadUseCase();
    const dto = await getDailyGrid(DAY, gridFixture().deps);

    for (const criterion of [...dto.rows, ...dto.columns]) {
      expect(Object.keys(criterion).sort()).toEqual(["kind", "label"]);
    }
    expect(Object.keys(dto).sort()).toEqual(["columns", "date", "rows"]);
  });

  it("aynı gün aynı ızgarayı verir (BR-11)", async () => {
    const { getDailyGrid } = await loadUseCase();
    const deps = gridFixture().deps;

    expect(await getDailyGrid(DAY, deps)).toEqual(
      await getDailyGrid(new Date("2026-07-31T23:00:00Z"), deps),
    );
  });

  /**
   * Üretim gerçek depolarla 432 ms sürüyor (§9.1). Bu maliyeti günün yalnızca
   * ilk isteği ödemeli; `checkAnswer` her cevapta ızgarayı yeniden istediği
   * için önbellek olmadan her tıklama o bedeli öderdi.
   */
  it("aynı gün ikinci kez sorgulanmaz — önbellek", async () => {
    const { getDailyGrid } = await loadUseCase();
    const fixture = gridFixture();

    await getDailyGrid(DAY, fixture.deps);
    const afterFirst = fixture.callCount();

    await getDailyGrid(DAY, fixture.deps);
    expect(fixture.callCount()).toBe(afterFirst);
  });

  it("gün değişince yeniden üretir", async () => {
    const { getDailyGrid } = await loadUseCase();
    const fixture = gridFixture();

    await getDailyGrid(DAY, fixture.deps);
    const afterFirst = fixture.callCount();

    await getDailyGrid(OTHER_DAY, fixture.deps);
    expect(fixture.callCount()).toBeGreaterThan(afterFirst);
  });

  it("üretilemezse GridUnavailableError fırlatır", async () => {
    const { getDailyGrid, GridUnavailableError } = await loadUseCase();

    await expect(
      getDailyGrid(DAY, {
        clubs: new FakeClubRepository([]),
        players: new FakePlayerRepository([]),
      }),
    ).rejects.toThrow(GridUnavailableError);
  });
});

describe("checkAnswer — BR-12", () => {
  it("iki kriteri de sağlayan oyuncu için true döner", async () => {
    const { checkAnswer, getDailyGrid } = await loadUseCase();
    const fixture = gridFixture();

    // Izgarayı üretip GERÇEK kriter çiftini öğren; hangi kulüplerin seçildiği
    // tohuma bağlı ve testin bunu varsayması kırılgan olurdu.
    await getDailyGrid(DAY, fixture.deps);
    const grid = await generateGrid(dailySeed(DAY), fixture.deps);
    expect(grid).not.toBeNull();

    const row = grid!.rows[0];
    const column = grid!.columns[0];
    expect(row?.type).toBe("club");
    expect(column?.type).toBe("club");
    if (row?.type !== "club" || column?.type !== "club") return;

    const answer = fixture.playerAtBoth(row.clubId, column.clubId);

    expect(
      await checkAnswer(
        {
          now: DAY,
          cell: { row: 0, column: 0 },
          playerId: playerId(answer),
        },
        fixture.deps,
      ),
    ).toEqual({ correct: true });
  });

  it("kriterleri sağlamayan oyuncu için false döner", async () => {
    const { checkAnswer, getDailyGrid } = await loadUseCase();
    const fixture = gridFixture();
    await getDailyGrid(DAY, fixture.deps);

    const grid = await generateGrid(dailySeed(DAY), fixture.deps);
    const row = grid?.rows[0];
    const column = grid?.columns[1];
    if (row?.type !== "club" || column?.type !== "club") {
      throw new Error("Beklenen kulüp kriteri üretilmedi.");
    }

    // Bu oyuncu 0. satır ile 1. SÜTUNUN çiftine ait; 0. sütuna cevap değil.
    const wrongCell = fixture.playerAtBoth(row.clubId, column.clubId);

    expect(
      await checkAnswer(
        {
          now: DAY,
          cell: { row: 0, column: 0 },
          playerId: playerId(wrongCell),
        },
        fixture.deps,
      ),
    ).toEqual({ correct: false });
  });

  /**
   * Var olmayan bir kimlik 404 DEĞİL, "yanlış cevap"tır. 404 dönmek, hangi
   * kimliklerin var olduğunu ayırt etmeyi — yani numaralandırmayı — mümkün
   * kılardı.
   */
  it("var olmayan oyuncu kimliği false döner, hata değil", async () => {
    const { checkAnswer, getDailyGrid } = await loadUseCase();
    const fixture = gridFixture();
    await getDailyGrid(DAY, fixture.deps);

    expect(
      await checkAnswer(
        { now: DAY, cell: { row: 0, column: 0 }, playerId: playerId("yok") },
        fixture.deps,
      ),
    ).toEqual({ correct: false });
  });

  it("yanıt yalnızca doğruluğu taşır", async () => {
    const { checkAnswer, getDailyGrid } = await loadUseCase();
    const fixture = gridFixture();
    await getDailyGrid(DAY, fixture.deps);

    const result = await checkAnswer(
      { now: DAY, cell: { row: 1, column: 2 }, playerId: playerId("yok") },
      fixture.deps,
    );

    expect(Object.keys(result)).toEqual(["correct"]);
  });

  /**
   * Aralık dışı hücre bir SUNUCU hatası değil, geçersiz bir GİRDİDİR — 400,
   * 500 değil.
   */
  it.each([
    ["negatif satır", { row: -1, column: 0 }],
    ["taşan sütun", { row: 0, column: GRID_SIZE }],
    ["tam sayı olmayan", { row: 0.5, column: 0 }],
  ])("aralık dışı hücre (%s) ValidationError üretir", async (_label, cell) => {
    const { checkAnswer, ValidationError } = await loadUseCase();

    await expect(
      checkAnswer(
        { now: DAY, cell, playerId: playerId("x") },
        gridFixture().deps,
      ),
    ).rejects.toThrow(ValidationError);
  });
});
