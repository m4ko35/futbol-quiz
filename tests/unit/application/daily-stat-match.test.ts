import { describe, expect, it, vi } from "vitest";
import type { StatMatchTarget } from "@/application/ports/stat-match-repository";
import { STAT_KEYS, scoreFor } from "@/domain/services/stat-match";
import { playerId } from "@/domain/value-objects/identifiers";
import { FakeStatMatchRepository } from "../../helpers/fake-repositories";

/** §9.2 — günlük istatistik eşleştirme use-case'i (BR-15…BR-20). */

const DAY = new Date("2026-07-31T09:00:00Z");
const OTHER_DAY = new Date("2026-08-05T09:00:00Z");

function aStatPlayer(
  id: string,
  overrides: Partial<StatMatchTarget["stats"]> = {},
): StatMatchTarget {
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
      birthYear: 1990,
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

/**
 * §9.2 — "Sen seç": hedefi kullanıcı belirler (BR-24).
 *
 * Buradaki testlerin çoğu tek bir şeyi koruyor: hedefin İSTEMCİDEN gelmesi,
 * hedefin DOĞRULANMADAN kabul edildiği anlamına gelmez. BR-20 bozulursa
 * kullanıcı kendi hedefini uydurup her seçimde %100 alırdı.
 */
describe("getChosenStatMatch", () => {
  it("seçilen oyuncunun altı istatistiğini döner", async () => {
    const { getChosenStatMatch } = await load();
    const target = aStatPlayer("secilen", { appearances: 408 });

    const dto = await getChosenStatMatch(playerId("secilen"), {
      statMatch: new FakeStatMatchRepository([], [target]),
    });

    expect(dto.player.name).toBe("Oyuncu secilen");
    expect(dto.stats.map((s) => s.key)).toEqual([...STAT_KEYS]);
    expect(dto.stats.find((s) => s.key === "appearances")?.value).toBe(408);
  });

  /** Günlük turun tersine tarih YOK: tur bir güne ait değil, saklanmıyor. */
  it("tarih taşımaz", async () => {
    const { getChosenStatMatch } = await load();

    const dto = await getChosenStatMatch(playerId("secilen"), {
      statMatch: new FakeStatMatchRepository([], [aStatPlayer("secilen")]),
    });

    expect(dto).not.toHaveProperty("date");
  });

  /**
   * BR-24 — uygun olmayan hedef REDDEDİLİR. Sessizce başka bir oyuncuya
   * kaydırmak, kullanıcının aradığı ismi bulduğunu sanmasına yol açardı.
   */
  it("havuzda olmayan oyuncuyu reddeder", async () => {
    const { getChosenStatMatch, ValidationError } = await load();

    await expect(
      getChosenStatMatch(playerId("yok"), {
        statMatch: new FakeStatMatchRepository([], [aStatPlayer("baska")]),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  /** Günün oyuncusu havuzu ile hedef havuzu AYRIDIR (1.927'ye karşı 5.524). */
  it("günün havuzunda olmayan ama seçilebilir oyuncuyu kabul eder", async () => {
    const { getChosenStatMatch } = await load();

    const dto = await getChosenStatMatch(playerId("yalnizca-hedef"), {
      statMatch: new FakeStatMatchRepository(
        [aStatPlayer("gunun")],
        [aStatPlayer("yalnizca-hedef")],
      ),
    });

    expect(dto.player.id).toBe("yalnizca-hedef");
  });
});

describe("checkStatAnswer — seçilen hedefle", () => {
  it("puanı GÜNÜN oyuncusuna değil, seçilen hedefe göre verir", async () => {
    const { checkStatAnswer } = await load();
    const statMatch = new FakeStatMatchRepository(
      [aStatPlayer("gunun", { appearances: 200 })],
      [
        aStatPlayer("hedef", { appearances: 500 }),
        aStatPlayer("cevap", { appearances: 490 }),
      ],
    );

    const result = await checkStatAnswer(
      {
        now: DAY,
        statKey: "appearances",
        playerId: playerId("cevap"),
        targetId: playerId("hedef"),
      },
      { statMatch },
    );

    expect(result.value).toBe(490);
    expect(result.score).toBe(scoreFor("appearances", 500, 490));
  });

  /** BR-20 — istemcinin gönderdiği hedef DOĞRULANIR, olduğu gibi kabul edilmez. */
  it("geçersiz hedef kimliğini reddeder", async () => {
    const { checkStatAnswer, ValidationError } = await load();

    await expect(
      checkStatAnswer(
        {
          now: DAY,
          statKey: "appearances",
          playerId: playerId("cevap"),
          targetId: playerId("uydurma"),
        },
        {
          statMatch: new FakeStatMatchRepository([], [aStatPlayer("cevap")]),
        },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  /** Hedefin kendisi cevap olsaydı bedava %100 olurdu. */
  it("hedefin kendisini cevap olarak reddeder", async () => {
    const { checkStatAnswer, ValidationError } = await load();

    await expect(
      checkStatAnswer(
        {
          now: DAY,
          statKey: "appearances",
          playerId: playerId("hedef"),
          targetId: playerId("hedef"),
        },
        {
          statMatch: new FakeStatMatchRepository([], [aStatPlayer("hedef")]),
        },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  /** `targetId` yoksa davranış DEĞİŞMEZ: hedef günün oyuncusudur. */
  it("targetId verilmezse günün oyuncusunu hedef alır", async () => {
    const { checkStatAnswer } = await load();
    // Aday havuzu TEK kişilik: iki aday olsaydı gün tohumu hangisini
    // seçeceğini belirlerdi ve test kendi kurgusunu sınardı.
    const statMatch = new FakeStatMatchRepository(
      [aStatPlayer("gunun", { appearances: 200 })],
      [aStatPlayer("cevap", { appearances: 190 })],
    );

    const result = await checkStatAnswer(
      { now: DAY, statKey: "appearances", playerId: playerId("cevap") },
      { statMatch },
    );

    expect(result.score).toBe(scoreFor("appearances", 200, 190));
  });
});
