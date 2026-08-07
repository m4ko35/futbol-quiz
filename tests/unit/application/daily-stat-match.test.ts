import { describe, expect, it, vi } from "vitest";
import type { DailyStatPlayer } from "@/application/ports/stat-match-repository";
import { STAT_KEYS, scoreFor } from "@/domain/services/stat-match";
import { playerId } from "@/domain/value-objects/identifiers";
import { FakeStatMatchRepository } from "../../helpers/fake-repositories";

/** §9.2 — günlük istatistik eşleştirme use-case'i (BR-15…BR-20). */

const DAY = new Date("2026-07-31T09:00:00Z");
const OTHER_DAY = new Date("2026-08-05T09:00:00Z");

function aStatPlayer(
  id: string,
  overrides: Partial<DailyStatPlayer["stats"]> = {},
): DailyStatPlayer {
  return {
    id: playerId(id),
    name: `Oyuncu ${id}`,
    nationality: "TR",
    stats: {
      appearances: 200,
      goals: 20,
      clubs: 3,
      nationalCaps: 30,
      heightCm: 180,
      weightKg: 75,
      ...overrides,
    },
  };
}

/**
 * Use-case gün bazlı bir bellek tutar; her test kendi modül örneğini alır.
 * Hata sınıfları da AYNI taze grafikten gelir — statik `import` farklı bir
 * sınıf kimliği verir ve `instanceof` yanlış yere `false` döner.
 */
async function load() {
  vi.resetModules();
  const [useCase, errors] = await Promise.all([
    import("@/application/use-cases/daily-stat-match"),
    import("@/domain/errors/domain-error"),
  ]);
  return { ...useCase, ...errors };
}

describe("getDailyStatMatch", () => {
  it("altı istatistiği de döner", async () => {
    const { getDailyStatMatch } = await load();

    const dto = await getDailyStatMatch(DAY, {
      statMatch: new FakeStatMatchRepository([aStatPlayer("p1")]),
    });

    expect(dto.date).toBe("2026-07-31");
    expect(dto.stats.map((s) => s.key)).toEqual([...STAT_KEYS]);
    expect(dto.player.name).toBe("Oyuncu p1");
  });

  /**
   * IZGARANIN TERSİNE hedef değerler AÇIKÇA verilir: oyun onları bilmeyi
   * değil, onlara yakın başka oyuncuları bilmeyi sorar (§9.2).
   */
  it("hedef değerleri gizlemez", async () => {
    const { getDailyStatMatch } = await load();

    const dto = await getDailyStatMatch(DAY, {
      statMatch: new FakeStatMatchRepository([
        aStatPlayer("p1", { appearances: 194, goals: 83 }),
      ]),
    });

    expect(dto.stats.find((s) => s.key === "appearances")?.value).toBe(194);
    expect(dto.stats.find((s) => s.key === "goals")?.value).toBe(83);
  });

  /** Kapsam bildirimi (§1.3): kulüp kaynaklı sayılar yirmi dört ligle sınırlı. */
  it("kapsamlı istatistikleri işaretler", async () => {
    const { getDailyStatMatch } = await load();

    const dto = await getDailyStatMatch(DAY, {
      statMatch: new FakeStatMatchRepository([aStatPlayer("p1")]),
    });

    const scoped = dto.stats.filter((s) => s.scoped).map((s) => s.key);
    expect(scoped).toEqual(["appearances", "goals", "clubs"]);
  });

  it("aynı gün aynı oyuncuyu verir (BR-19)", async () => {
    const { getDailyStatMatch } = await load();
    const deps = {
      statMatch: new FakeStatMatchRepository([
        aStatPlayer("p1"),
        aStatPlayer("p2"),
        aStatPlayer("p3"),
      ]),
    };

    const first = await getDailyStatMatch(DAY, deps);
    const second = await getDailyStatMatch(
      new Date("2026-07-31T23:00:00Z"),
      deps,
    );

    expect(first.player.id).toBe(second.player.id);
  });

  it("farklı gün farklı oyuncu seçebilir", async () => {
    const { getDailyStatMatch } = await load();
    const many = Array.from({ length: 50 }, (_, i) =>
      aStatPlayer(`p${String(i)}`),
    );
    const deps = { statMatch: new FakeStatMatchRepository(many) };

    const a = await getDailyStatMatch(DAY, deps);
    const b = await getDailyStatMatch(OTHER_DAY, deps);

    expect(a.player.id).not.toBe(b.player.id);
  });

  /** Aday yoksa sessizce boş ekran değil, HATA (§2.7). */
  it("aday yoksa StatMatchUnavailableError fırlatır", async () => {
    const { getDailyStatMatch, StatMatchUnavailableError } = await load();

    await expect(
      getDailyStatMatch(DAY, { statMatch: new FakeStatMatchRepository([]) }),
    ).rejects.toThrow(StatMatchUnavailableError);
  });
});

describe("checkStatAnswer — BR-18, BR-20", () => {
  const CANDIDATES = [
    aStatPlayer("pA", { appearances: 200 }),
    aStatPlayer("pB", { appearances: 260 }),
  ];

  /**
   * Hangi adayın günün oyuncusu olduğu TOHUMA bağlı; test bunu varsaymaz,
   * use-case'ten okur. Varsaysaydı tohum değiştiğinde sebepsiz kırılırdı.
   */
  async function setup() {
    const useCase = await load();
    const repository = new FakeStatMatchRepository(CANDIDATES);
    const deps = { statMatch: repository };

    const daily = await useCase.getDailyStatMatch(DAY, deps);
    const answer = CANDIDATES.find((c) => c.id !== daily.player.id);
    if (answer === undefined) throw new Error("Cevap adayı yok.");

    return { ...useCase, repository, deps, daily, answer };
  }

  it("seçilen oyuncunun değerini ve puanını döner", async () => {
    const { checkStatAnswer, deps, daily, answer } = await setup();
    const target = daily.stats.find((s) => s.key === "appearances")?.value ?? 0;

    const result = await checkStatAnswer(
      { now: DAY, statKey: "appearances", playerId: answer.id },
      deps,
    );

    expect(result).toEqual({
      value: answer.stats.appearances,
      score: scoreFor("appearances", target, answer.stats.appearances),
    });
  });

  it("yanıt yalnızca değer ve puan taşır", async () => {
    const { checkStatAnswer, deps, answer } = await setup();

    const result = await checkStatAnswer(
      { now: DAY, statKey: "goals", playerId: answer.id },
      deps,
    );

    expect(Object.keys(result).sort()).toEqual(["score", "value"]);
  });

  /** Hedefin kendisi cevap olsaydı her istatistikte bedava %100 olurdu. */
  it("günün oyuncusu cevap olarak seçilemez", async () => {
    const { checkStatAnswer, ValidationError, deps, daily } = await setup();

    await expect(
      checkStatAnswer(
        {
          now: DAY,
          statKey: "appearances",
          playerId: playerId(daily.player.id),
        },
        deps,
      ),
    ).rejects.toThrow(ValidationError);
  });

  /**
   * BR-16 — puanlanamayan seçim sessizce 0 sayılmaz. Sıfır vermek kullanıcıya
   * "çok uzaktın" der; doğrusu "bu oyuncunun verisi yok".
   */
  it("verisi olmayan oyuncu için ValidationError fırlatır", async () => {
    const { checkStatAnswer, ValidationError, deps } = await setup();

    await expect(
      checkStatAnswer(
        { now: DAY, statKey: "appearances", playerId: playerId("yok") },
        deps,
      ),
    ).rejects.toThrow(ValidationError);
  });

  /** Aday sorgusu tüm dönem tablosunu tarar; günde bir kez ödenmelidir. */
  it("aynı gün adayları YENİDEN sorgulamaz", async () => {
    const { checkStatAnswer, repository, deps, answer } = await setup();
    const spy = vi.spyOn(repository, "findDailyCandidates");

    await checkStatAnswer(
      { now: DAY, statKey: "goals", playerId: answer.id },
      deps,
    );

    // `setup` zaten bir kez çekti; ikinci çağrı bellekten gelmeli.
    expect(spy).not.toHaveBeenCalled();
  });
});
