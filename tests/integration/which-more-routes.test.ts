import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { CURATED_CLUB_QIDS } from "@/application/curated-clubs";
import { STAT_KEYS } from "@/domain/services/stat-match";
import { LEVELS, MIN_GAP } from "@/domain/services/which-more";
import { playerId } from "@/domain/value-objects/identifiers";
import { toSearchKey } from "@/domain/value-objects/search-key";
import { PrismaStatMatchRepository } from "@/infrastructure/db/repositories/prisma-stat-match-repository";
import { PrismaWhichMoreRepository } from "@/infrastructure/db/repositories/prisma-which-more-repository";
import {
  createTestDatabase,
  type TestDatabase,
} from "../helpers/test-database";

/**
 * "Hangisi daha" uçlarının sözleşme testleri — §6.6, §9.3.
 *
 * Route handler'lar GERÇEKTEN çağrılır ve depo gerçek Prisma'dır: tanınırlık
 * havuzu (BR-31) ham SQL toplamasıyla yazıldığı için ancak gerçek bir
 * veritabanına karşı denetlenebilir.
 */

let db: TestDatabase;
let roundRoute: typeof import("@/app/api/hangisi-daha/round/route");
let answerRoute: typeof import("@/app/api/hangisi-daha/answer/route");

const CLUB_A = CURATED_CLUB_QIDS[0]!;
const CLUB_B = CURATED_CLUB_QIDS[1]!;
const clubIdOf = (qid: string) => `club-${qid}`;

/**
 * Tanınır oyuncular — küratörlü iki kulüpte 100+ maç (BR-31).
 *
 * DEĞERLER HER İSTATİSTİKTE BANDIN ÜSTÜNDE ayrıldı (BR-29): boy 20 cm arayla
 * (band 3), maç sayısı 60 arayla (band 25), gol 24+ (band 5), millî maç 20+
 * (band 5). İlk yazımda maç sayıları 10–20 arayla duruyordu ve sunucu çifti
 * haklı olarak reddediyordu — fikstürün kendisi kuralı çiğniyordu.
 *
 * ÜÇÜ DE "BİLİNDİK" (BR-41): 20+ millî maç ve 2000 sonrası son dönem. Zorunlu,
 * çünkü seviyenin varsayılanı "easy" — aksi hâlde bu üç oyuncu varsayılan
 * havuzdan düşer ve aşağıdaki testlerin hiçbiri kurulamazdı. h160'ın millî
 * maçı 10'du, 20'ye çıkarıldı; kalan aralık (20/30/60) bandın hâlâ üstünde.
 */
const NOTABLE = [
  {
    id: "h160",
    height: 160,
    apps: [80, 40],
    goals: [4, 2],
    caps: 20,
    natGoals: 2,
    clubApps: 150,
    clubGoals: 8,
    lastYear: 2010,
  },
  {
    id: "h180",
    height: 180,
    apps: [120, 60],
    goals: [20, 10],
    caps: 30,
    natGoals: 9,
    clubApps: 230,
    clubGoals: 40,
    lastYear: 2012,
  },
  {
    id: "h200",
    height: 200,
    apps: [150, 90],
    goals: [40, 30],
    caps: 60,
    natGoals: 22,
    clubApps: 330,
    clubGoals: 95,
    lastYear: 2015,
  },
];

/**
 * BR-41 — tanınır AMA bilindik DEĞİL. İki ölçütün her biri için bir oyuncu.
 *
 * Boyları öteki üçünden ve birbirinden 10 cm uzakta (band 3): "hard" havuzunda
 * gerçekten eşleşebilirler, yani kolay havuzda görünmemeleri bir tesadüf değil
 * süzgecin sonucudur.
 */
const OBSCURE = [
  // Yıl ölçütüne takılır: millî maçı bol ama 2000'den önce bıraktı.
  { id: "eski", height: 190, caps: 40, lastYear: 1995 },
  // Millî maç ölçütüne takılır: çağdaş ama millî takımda neredeyse hiç oynamadı.
  { id: "capsiz", height: 170, caps: 3, lastYear: 2015 },
];

let clientCounter = 0;
function post(path: string, body: unknown): NextRequest {
  clientCounter += 1;
  return new NextRequest(new URL(`http://localhost${path}`), {
    method: "POST",
    headers: {
      "x-forwarded-for": `192.0.2.${clientCounter % 250}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

interface RoundBody {
  statKey: string;
  pair: {
    left: { id: string; name: string; clubs: string[] };
    right: { id: string; name: string; clubs: string[] };
  } | null;
}

async function round(body: unknown): Promise<RoundBody> {
  const response = await roundRoute.POST(post("/api/hangisi-daha/round", body));
  expect(response.status).toBe(200);
  const payload = await response.json();
  return payload.data as RoundBody;
}

beforeAll(async () => {
  db = createTestDatabase();

  await db.prisma.club.createMany({
    data: [CLUB_A, CLUB_B].map((qid) => ({
      id: clubIdOf(qid),
      wikidataId: qid,
      name: `Kulüp ${qid}`,
      shortName: `Kulüp ${qid}`,
      searchKey: toSearchKey(`Kulüp ${qid}`),
      isSelectable: true,
    })),
  });

  for (const player of NOTABLE) {
    await db.prisma.player.create({
      data: {
        id: player.id,
        wikidataId: `Q${player.id}`,
        name: `Tanınır ${player.id}`,
        searchKey: toSearchKey(`Tanınır ${player.id}`),
        heightCm: player.height,
        nationalCaps: player.caps,
        // BR-23'ün resmî toplamı: kulüp kariyeri + millî. Dönemlerden BÜYÜK,
        // çünkü kupa ve Avrupa maçlarını da içerir.
        nationalGoals: player.natGoals,
        clubCareerAppearances: player.clubApps,
        clubCareerGoals: player.clubGoals,
        spells: {
          create: [CLUB_A, CLUB_B].map((qid, i) => ({
            wikidataStatementId: `${player.id}-${String(i)}`,
            clubId: clubIdOf(qid),
            appearances: player.apps[i],
            goals: player.goals[i],
            endYear: player.lastYear,
          })),
        },
      },
    });
  }

  for (const player of OBSCURE) {
    await db.prisma.player.create({
      data: {
        id: player.id,
        wikidataId: `Q${player.id}`,
        name: `Silik ${player.id}`,
        searchKey: toSearchKey(`Silik ${player.id}`),
        heightCm: player.height,
        nationalCaps: player.caps,
        nationalGoals: 2,
        clubCareerAppearances: 260,
        clubCareerGoals: 14,
        spells: {
          create: [CLUB_A, CLUB_B].map((qid, i) => ({
            wikidataStatementId: `${player.id}-${String(i)}`,
            clubId: clubIdOf(qid),
            appearances: 100 + i * 10,
            goals: 5 + i,
            endYear: player.lastYear,
          })),
        },
      },
    });
  }

  // TANINMAZ: tek kulüp ve 100 maçın altında (BR-31). Hiçbir turda çıkmamalı.
  await db.prisma.player.create({
    data: {
      id: "taninmaz",
      wikidataId: "Qtaninmaz",
      name: "Tanınmaz Oyuncu",
      searchKey: toSearchKey("Tanınmaz Oyuncu"),
      heightCm: 175,
      spells: {
        create: [
          {
            wikidataStatementId: "taninmaz-0",
            clubId: clubIdOf(CLUB_A),
            appearances: 20,
            goals: 1,
          },
        ],
      },
    },
  });

  // BOYU YOK: `heightCm` havuzuna girmez ama `appearances` havuzuna girer.
  await db.prisma.player.create({
    data: {
      id: "boysuz",
      wikidataId: "Qboysuz",
      name: "Boysuz Oyuncu",
      searchKey: toSearchKey("Boysuz Oyuncu"),
      // Bilindik (BR-41): eksik olan yalnızca BOY olsun, seviye olmasın.
      nationalCaps: 25,
      nationalGoals: 4,
      clubCareerAppearances: 241,
      clubCareerGoals: 9,
      spells: {
        create: [CLUB_A, CLUB_B].map((qid, i) => ({
          wikidataStatementId: `boysuz-${String(i)}`,
          clubId: clubIdOf(qid),
          appearances: 120 + i,
          goals: 3,
          endYear: 2014,
        })),
      },
    },
  });

  // KARİYER TOPLAMI EKSİK: `appearances`/`goals` değeri `null` sayılır
  // (§2.7, BR-23) — resmî toplamın kulüp yarısı okunamamış.
  await db.prisma.player.create({
    data: {
      id: "eksik",
      wikidataId: "Qeksik",
      name: "Eksik Veri",
      searchKey: toSearchKey("Eksik Veri"),
      heightCm: 178,
      // Bilindik (BR-41): eksik olan yalnızca KARİYER TOPLAMI olsun.
      nationalCaps: 22,
      nationalGoals: 5,
      clubCareerAppearances: null,
      clubCareerGoals: null,
      spells: {
        create: [
          {
            wikidataStatementId: "eksik-0",
            clubId: clubIdOf(CLUB_A),
            appearances: 150,
            goals: 10,
            endYear: 2013,
          },
          {
            wikidataStatementId: "eksik-1",
            clubId: clubIdOf(CLUB_B),
            appearances: null,
            goals: null,
            endYear: 2013,
          },
        ],
      },
    },
  });

  process.env.DATABASE_URL = db.url;
  process.env.RATE_LIMIT_REQUESTS_PER_MINUTE ??= "60";
  process.env.RATE_LIMIT_BURST ??= "10";
  process.env.TRUSTED_PROXY_HOPS = "1";

  roundRoute = await import("@/app/api/hangisi-daha/round/route");
  answerRoute = await import("@/app/api/hangisi-daha/answer/route");
}, 120_000);

afterAll(async () => {
  await db.destroy();
});

describe("POST /api/hangisi-daha/round — §6.6", () => {
  it("iki oyuncu döner ve SAYI TAŞIMAZ (BR-32)", async () => {
    const data = await round({ statKey: "heightCm" });

    expect(data.pair).not.toBeNull();
    for (const player of [data.pair?.left, data.pair?.right]) {
      expect(Object.keys(player ?? {}).sort()).toEqual(["clubs", "id", "name"]);
    }
  });

  it("tanınmaz oyuncu HİÇBİR turda sunulmaz (BR-31)", async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const data = await round({ statKey: "heightCm" });
      seen.add(data.pair?.left.id ?? "");
      seen.add(data.pair?.right.id ?? "");
    }

    expect(seen.has("taninmaz")).toBe(false);
  });

  it("istatistiği olmayan oyuncu O havuzda yok, diğerinde var", async () => {
    const heights = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const data = await round({ statKey: "heightCm" });
      heights.add(data.pair?.left.id ?? "");
      heights.add(data.pair?.right.id ?? "");
    }
    expect(heights.has("boysuz")).toBe(false);

    // Aynı oyuncu maç sayısı havuzunda bulunabilir olmalı (BR-31).
    const repository = new PrismaWhichMoreRepository(db.prisma);
    const found = await repository.findPlayer(
      playerId("boysuz"),
      "appearances",
    );
    // Resmî toplam: 241 kulüp maçı + 25 A millî maç (BR-23).
    expect(found?.value).toBe(266);
  });

  it("kalan oyuncu SOLDA durur (BR-28)", async () => {
    const data = await round({ statKey: "heightCm", stayingId: "h180" });

    expect(data.pair?.left.id).toBe("h180");
    expect(data.pair?.right.id).not.toBe("h180");
  });

  it("dışlanan oyuncu sunulmaz (BR-28)", async () => {
    const data = await round({
      statKey: "heightCm",
      stayingId: "h180",
      exclude: ["h180", "h200"],
    });

    expect(data.pair?.right.id).toBe("h160");
  });

  /**
   * BR-30'un ASIL testi. Rakip hep kalandan büyük olsaydı "hep kalanı seç"
   * kazanan strateji olurdu (§9.3'te ölçüldü: %9,5–13,7 oranında 10+ seri).
   * Otuz turda iki tarafın da çıkması bunun kapalı olduğunu gösterir; tek
   * taraflı bir uygulamada bu testin geçme olasılığı 2 · 0,5³⁰.
   */
  it("rakip İKİ TARAFTAN da gelir (BR-30)", async () => {
    const opponents = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const data = await round({ statKey: "heightCm", stayingId: "h180" });
      opponents.add(data.pair?.right.id ?? "");
    }

    expect(opponents).toEqual(new Set(["h160", "h200"]));
  });

  it("havuz tükenince hata değil, pair: null döner", async () => {
    const data = await round({
      statKey: "heightCm",
      stayingId: "h180",
      exclude: ["h160", "h200"],
    });

    expect(data.pair).toBeNull();
  });

  /**
   * BR-41 — SEVİYE. Varsayılanın "easy" olması bir uygulama ayrıntısı değil,
   * modun var olma sebebi: alanı hiç göndermeyen istemci dar havuzu almalı.
   */
  it("seviye GÖNDERİLMEZSE kolay havuz kullanılır (BR-41)", async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const data = await round({ statKey: "heightCm" });
      seen.add(data.pair?.left.id ?? "");
      seen.add(data.pair?.right.id ?? "");
    }

    // İkisi de tanınır (BR-31) ve boyları eşleşmeye elverişli; dışarıda
    // kalmalarının TEK sebebi BR-41 olabilir.
    expect(seen.has("eski")).toBe(false);
    expect(seen.has("capsiz")).toBe(false);
    expect(seen.has("h160")).toBe(true);
  });

  it("'hard' seviyesinde İKİ ölçütün de elediği oyuncular çıkar", async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const data = await round({ statKey: "heightCm", level: "hard" });
      seen.add(data.pair?.left.id ?? "");
      seen.add(data.pair?.right.id ?? "");
    }

    // "eski" yıl ölçütüne, "capsiz" millî maç ölçütüne takılıyordu. İkisinin
    // birden dönmesi, "hard"ın gerçekten KAPSAYICI olduğunu gösterir.
    expect(seen.has("eski")).toBe(true);
    expect(seen.has("capsiz")).toBe(true);
  });

  it("kalan oyuncu seviye süzgecinden GEÇMEZ (BR-41)", async () => {
    // Bilinçli: kalan oyuncu bir önceki turda o seviyenin havuzundan çekilmişti
    // ve `findPlayer` tanınırlığı da sormuyor. İkinci bir süzgeç, sunucunun
    // kendi kurduğu turu reddetmesine yol açabilecek ikinci bir ayrışma
    // kaynağı olurdu. Test bu kararı SABİTLİYOR.
    const data = await round({
      statKey: "heightCm",
      level: "easy",
      stayingId: "eski",
    });

    expect(data.pair?.left.id).toBe("eski");
    // Rakip yine KOLAY havuzdan gelir — asıl kural burada.
    expect(["eski", "capsiz"]).not.toContain(data.pair?.right.id);
  });

  it("bilinmeyen seviye reddedilir", async () => {
    const response = await roundRoute.POST(
      post("/api/hangisi-daha/round", { statKey: "heightCm", level: "orta" }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("her seviye kendi havuzunda çift kurabilir", async () => {
    // §9.3'ün ölçümü kolay havuzun her istatistikte dolu olduğunu söylüyor;
    // burada aynı iddia gerçek bir veritabanına karşı sınanıyor.
    for (const level of LEVELS) {
      const data = await round({ statKey: "heightCm", level });
      expect(data.pair, level).not.toBeNull();
    }
  });

  it("bilinmeyen istatistik reddedilir", async () => {
    const response = await roundRoute.POST(
      post("/api/hangisi-daha/round", { statKey: "boyPosu" }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/hangisi-daha/answer — §6.6", () => {
  async function answer(body: unknown) {
    const response = await answerRoute.POST(
      post("/api/hangisi-daha/answer", body),
    );
    return { response, body: await response.json() };
  }

  it("doğru cevapta iki değeri de açar", async () => {
    const { response, body } = await answer({
      statKey: "heightCm",
      direction: "more",
      leftId: "h180",
      rightId: "h200",
      chosenId: "h200",
    });

    expect(response.status).toBe(200);
    expect(body.data.correct).toBe(true);
    expect(body.data.left.value).toBe(180);
    expect(body.data.right.value).toBe(200);
    expect(body.data.winnerId).toBe("h200");
  });

  it("'less' yönü kuralı ÇEVİRİR", async () => {
    const { body } = await answer({
      statKey: "heightCm",
      direction: "less",
      leftId: "h180",
      rightId: "h200",
      chosenId: "h200",
    });

    expect(body.data.correct).toBe(false);
    expect(body.data.winnerId).toBe("h180");
  });

  /**
   * BR-23 — 22 Ağustos 2026'da bu testin BEKLENTİSİ TERSİNE DÖNDÜ ve dönmesi
   * gerekiyordu: resmî maç artık kariyerin tamamını sayıyor, yani "yalnızca
   * 24 lig" uyarısını hak etmiyor. Kapsama bağlı kalan tek istatistik kulüp
   * sayısıdır; onun çifti bu fikstürde kurulamıyor (üç oyuncunun da 2 kulübü
   * var, band da 2) ve kurulmasına gerek de yok — burada denenen şey bayrağın
   * TAŞINMASI, değerin kendisi `isScoped`'un birim testinde.
   */
  it("kapsam bildirimi doğru taşınır", async () => {
    const { body } = await answer({
      statKey: "appearances",
      direction: "more",
      leftId: "h160",
      rightId: "h200",
      chosenId: "h160",
    });

    expect(body.data.scoped).toBe(false);
  });

  it("BAND ALTINDAKİ çift reddedilir (BR-29)", async () => {
    // 178 ile 180 arasında 2 cm var, band 3.
    const { response, body } = await answer({
      statKey: "heightCm",
      direction: "more",
      leftId: "eksik",
      rightId: "h180",
      chosenId: "h180",
    });

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("değeri olmayan oyuncu reddedilir", async () => {
    const { response } = await answer({
      statKey: "heightCm",
      direction: "more",
      leftId: "boysuz",
      rightId: "h180",
      chosenId: "h180",
    });

    expect(response.status).toBe(400);
  });

  it("turda sunulmamış oyuncu seçilemez", async () => {
    const { response } = await answer({
      statKey: "heightCm",
      direction: "more",
      leftId: "h160",
      rightId: "h180",
      chosenId: "h200",
    });

    expect(response.status).toBe(400);
  });
});

/**
 * İKİ MODUN AYNI SAYIYI VERDİĞİ, ölçülerek korunuyor.
 *
 * §9.2 ile §9.3 aynı istatistikleri kullanıyor ve değerleri AYRI kodda
 * hesaplıyor. Ayrışırlarsa kullanıcı aynı oyuncuyu iki sayfada iki farklı
 * değerle görür — ve daha kötüsü, sunucu kendi kurduğu çifti cevap ucunda
 * reddedebilir. Bu test o ayrışmayı sessiz kalmaktan çıkarır.
 */
describe("BR-41 — seviye cevabı ETKİLEMEZ", () => {
  it("kolay havuzda olmayan iki oyuncunun cevabı yine açılır", async () => {
    // Cevap ucu seviye ALMAZ ve alması da gerekmez: seviye hangi çiftin
    // KURULACAĞINI daraltır, hangi cevabın DOĞRU olduğunu değil. İki silik
    // oyuncu (190/170, band 3) gönderiliyor ve iki değer de dönüyor.
    const response = await answerRoute.POST(
      post("/api/hangisi-daha/answer", {
        statKey: "heightCm",
        direction: "more",
        leftId: "eski",
        rightId: "capsiz",
        chosenId: "eski",
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.correct).toBe(true);
    expect(body.data.left.value).toBe(190);
    expect(body.data.right.value).toBe(170);
  });
});

describe("değer tanımı §9.2 ile aynıdır", () => {
  it("her oyuncu ve her istatistikte iki depo aynı değeri verir", async () => {
    const whichMore = new PrismaWhichMoreRepository(db.prisma);
    const statMatch = new PrismaStatMatchRepository(db.prisma);
    const ids = ["h160", "h180", "h200", "boysuz", "eksik", "taninmaz"];

    let compared = 0;
    for (const id of ids) {
      for (const key of STAT_KEYS) {
        const mine = await whichMore.findPlayer(playerId(id), key);
        const theirs = await statMatch.findStatValue(playerId(id), key);

        expect(mine?.value ?? null).toBe(theirs);
        compared += 1;
      }
    }

    // Karşılaştırma gerçekten yapıldı; boş bir döngü yeşil görünmesin.
    expect(compared).toBe(ids.length * STAT_KEYS.length);
  });
});

/** Bandın sabitleri şartnamede yazılı olanlarla aynı kalmalı (§9.3). */
describe("BR-29 bandı", () => {
  it("ölçülen değerleri taşır", () => {
    expect(MIN_GAP).toEqual({
      appearances: 35,
      goals: 10,
      clubs: 2,
      nationalCaps: 5,
      heightCm: 3,
      birthYear: 5,
    });
  });
});
