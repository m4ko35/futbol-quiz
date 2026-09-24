import { describe, expect, it } from "vitest";
import {
  checkRailAnswer,
  railDuelAt,
  type RailDuel,
} from "@/application/use-cases/which-more-rooms";
import type {
  WhichMoreCandidate,
  WhichMoreCandidateQuery,
  WhichMoreRepository,
} from "@/application/ports/which-more-repository";
import { MIN_GAP } from "@/domain/services/which-more";
import type { WhichMoreRoomConfig } from "@/domain/services/which-more-room";
import type { PlayerId } from "@/domain/value-objects/identifiers";
import {
  FakeWhichMoreRepository,
  type FakeWhichMorePlayer,
} from "../../helpers/fake-repositories";

/**
 * §12.8 BR-68 — ortak rayın SUNUCUDA tekrar oynatılması.
 *
 * Ray mantığı (galip = veriyle, kalan solda, görülen dışlanır) deterministik
 * fake ile ölçülür; TOHUMUN aynı rayı vermesi (seçim rastgele olsa bile) ayrı
 * bir rastgelelik onurlandıran sahte depoyla ölçülür.
 */

/** Boy (band 3) — aralıklar geniş, zincir öngörülebilir. */
const HEIGHTS: FakeWhichMorePlayer[] = [
  { id: "a", name: "A", values: { heightCm: 170 } },
  { id: "b", name: "B", values: { heightCm: 185 } },
  { id: "c", name: "C", values: { heightCm: 200 } },
  { id: "d", name: "D", values: { heightCm: 215 } },
  { id: "e", name: "E", values: { heightCm: 230 } },
];

const VALUE: Record<string, number> = {
  a: 170,
  b: 185,
  c: 200,
  d: 215,
  e: 230,
};

const config: WhichMoreRoomConfig = {
  submode: "ani-olum",
  statKey: "heightCm",
  level: "hard",
  direction: "more",
  seed: 12345,
};

const deps = () => ({ whichMore: new FakeWhichMoreRepository(HEIGHTS) });

/** railDuelAt, null dönmemeli — dönerse test hatası. */
async function duel(
  cfg: WhichMoreRoomConfig,
  index: number,
): Promise<RailDuel> {
  const result = await railDuelAt(cfg, index, deps());
  if (result === null) throw new Error(`ray ${String(index)}. turda tükendi`);
  return result;
}

describe("railDuelAt — ortak ray (§12.8, BR-68)", () => {
  it("ilk düello ilk iki adayı sunar, galibi VERİYLE belirler (more)", async () => {
    const d0 = await duel(config, 0);
    expect(d0.left.id).toBe("a");
    expect(d0.right.id).toBe("b");
    expect(d0.winnerId).toBe("b"); // 185 > 170

    // Değersiz DTO — BR-32; bir gün `value` sızarsa bu kırılmalı.
    expect(Object.keys(d0.left).sort()).toEqual(["clubs", "id", "name"]);
  });

  it("kalan oyuncu bir sonraki düelloda SOLDA durur (BR-28)", async () => {
    const d0 = await duel(config, 0);
    const d1 = await duel(config, 1);
    expect(d1.left.id).toBe(d0.winnerId);
    expect(d1.right.id).toBe("c");
    expect(d1.winnerId).toBe("c");
  });

  it("galip her düelloda veriyle belirlenir (more → yüksek değer)", async () => {
    for (let i = 0; i < 4; i += 1) {
      const d = await duel(config, i);
      const lv = VALUE[d.left.id] ?? 0;
      const rv = VALUE[d.right.id] ?? 0;
      expect(d.winnerId).toBe(lv > rv ? d.left.id : d.right.id);
    }
  });

  it("less yönünde galip DÜŞÜK değerli olandır", async () => {
    const d0 = await duel({ ...config, direction: "less" }, 0);
    expect(d0.winnerId).toBe("a"); // 170 < 185
  });

  it("görülen oyuncu bir daha sunulmaz — her düelloda yeni rakip (BR-28)", async () => {
    const rights = [
      (await duel(config, 0)).right.id,
      (await duel(config, 1)).right.id,
      (await duel(config, 2)).right.id,
      (await duel(config, 3)).right.id,
    ];
    expect(rights).toEqual(["b", "c", "d", "e"]);
    expect(new Set(rights).size).toBe(4);
  });

  it("ray tükenince null döner — havuz zinciri besleyemez (§6.6, hata değil)", async () => {
    expect(await railDuelAt(config, 4, deps())).toBeNull();
  });

  it("aynı (tohum, indeks) her zaman aynı düelloyu verir", async () => {
    const first = await railDuelAt(config, 2, deps());
    const second = await railDuelAt(config, 2, deps());
    expect(second).toEqual(first);
  });
});

describe("checkRailAnswer — sunucuda doğrulama (§12.8, BR-32/BR-68)", () => {
  it("doğru kartı seçince correct=true ve galibi döner", async () => {
    expect(await checkRailAnswer(config, 0, "b", deps())).toEqual({
      correct: true,
      winnerId: "b",
    });
  });

  it("yanlış kartı seçince correct=false", async () => {
    expect(await checkRailAnswer(config, 0, "a", deps())).toEqual({
      correct: false,
      winnerId: "b",
    });
  });

  it("o düelloda sunulmayan kart → null (geçersiz gönderim)", async () => {
    expect(await checkRailAnswer(config, 0, "e", deps())).toBeNull();
  });

  it("ray tükendiyse → null", async () => {
    expect(await checkRailAnswer(config, 4, "x", deps())).toBeNull();
  });
});

/**
 * Rastgeleliği ONURLANDIRAN sahte depo — seçim `random`'a bağlı.
 *
 * `FakeWhichMoreRepository` sıradaki ilk adayı seçer (deterministik), o yüzden
 * TOHUMUN etkisini gösteremez. Bu depo band/taraf/dışlamayı uygular AMA uygun
 * adaylar arasından `random` ile seçer — tıpkı gerçek depo (§9.3) gibi. Böylece
 * "aynı tohum aynı ray" iddiası (BR-68) seçim gerçekten rastgeleyken sınanır.
 */
class RandomHonoringRepository implements WhichMoreRepository {
  readonly #pool: readonly { id: string; name: string; value: number }[];

  constructor(pool: readonly { id: string; name: string; value: number }[]) {
    this.#pool = pool;
  }

  findCandidate(
    query: WhichMoreCandidateQuery,
    random: () => number = Math.random,
  ): Promise<WhichMoreCandidate | null> {
    const gap = MIN_GAP[query.statKey];
    const excluded = new Set<string>(query.exclude);

    const valid = this.#pool.filter((p) => {
      if (excluded.has(p.id)) return false;
      if (query.threshold === null) return true;
      if (Math.abs(p.value - query.threshold) < gap) return false;
      if (query.side === "above") return p.value > query.threshold;
      if (query.side === "below") return p.value < query.threshold;
      return true;
    });

    if (valid.length === 0) return Promise.resolve(null);
    const chosen = valid[Math.floor(random() * valid.length)] ?? valid[0];
    if (chosen === undefined) return Promise.resolve(null);
    return Promise.resolve({
      id: chosen.id as PlayerId,
      name: chosen.name,
      clubs: [],
      value: chosen.value,
    });
  }

  findPlayer(id: PlayerId): Promise<WhichMoreCandidate | null> {
    const p = this.#pool.find((one) => one.id === id);
    return Promise.resolve(
      p === undefined ? null : { id, name: p.name, clubs: [], value: p.value },
    );
  }
}

describe("railDuelAt — tohum ortak rayı belirler (§12.8, BR-68)", () => {
  // Bol adaylı havuz: birden çok aday banda girer, yani seçim gerçekten rastgele.
  const BIG = Array.from({ length: 12 }, (_, i) => ({
    id: `p${String(i)}`,
    name: `P${String(i)}`,
    value: 160 + i * 5,
  }));

  const chain = (
    cfg: WhichMoreRoomConfig,
    dep: { whichMore: WhichMoreRepository },
  ) => Promise.all([0, 1, 2, 3, 4].map((i) => railDuelAt(cfg, i, dep)));

  it("seçim rastgele olsa da AYNI tohum aynı rayı verir", async () => {
    const dep = { whichMore: new RandomHonoringRepository(BIG) };
    expect(await chain(config, dep)).toEqual(await chain(config, dep));
  });

  it("FARKLI tohum farklı ray verebilir", async () => {
    const dep = { whichMore: new RandomHonoringRepository(BIG) };
    const a = await chain({ ...config, seed: 1 }, dep);
    const b = await chain({ ...config, seed: 987654 }, dep);
    expect(b).not.toEqual(a);
  });
});
