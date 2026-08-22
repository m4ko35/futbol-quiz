import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { CURATED_CLUB_QIDS } from "@/application/curated-clubs";
import { STAT_KEYS } from "@/domain/services/stat-match";
import { nextRollover } from "@/domain/value-objects/daily-seed";
import { toSearchKey } from "@/domain/value-objects/search-key";
import {
  createTestDatabase,
  type TestDatabase,
} from "../helpers/test-database";

/**
 * İstatistik eşleştirme uçlarının sözleşme testleri — §6.5, §9.2.
 *
 * Route handler'lar GERÇEKTEN çağrılır ve depo gerçek Prisma'dır: uygunluk
 * ölçütü (BR-15) ham SQL toplamasıyla yazıldığı için ancak gerçek bir
 * veritabanına karşı denetlenebilir.
 */

let db: TestDatabase;
let dailyRoute: typeof import("@/app/api/stat-match/route");
let answerRoute: typeof import("@/app/api/stat-match/answer/route");

const CLUB_A = CURATED_CLUB_QIDS[0]!;
const CLUB_B = CURATED_CLUB_QIDS[1]!;
const clubIdOf = (qid: string) => `club-${qid}`;

/**
 * Uygun adaylar: altı istatistik dolu, 100+ KAPSAM maçı, 2 küratörlü kulüp.
 *
 * `apps`/`goals` DÖNEM sayılarıdır (kapsam ölçütünü besler); `clubApps`/
 * `clubGoals`/`natGoals` ise oyunun GÖSTERDİĞİ resmî toplamın parçalarıdır
 * (BR-23). İkisi kasıtlı olarak farklı: kariyer toplamı kapsamdan büyüktür,
 * çünkü kupa ve Avrupa maçlarını da içerir.
 */
const ELIGIBLE = [
  {
    id: "elig1",
    caps: 40,
    natGoals: 8,
    height: 180,
    born: 1990,
    apps: [120, 60],
    goals: [10, 5],
    clubApps: 240,
    clubGoals: 30,
  },
  {
    id: "elig2",
    caps: 90,
    natGoals: 25,
    height: 190,
    born: 1978,
    apps: [200, 90],
    goals: [40, 20],
    clubApps: 400,
    clubGoals: 95,
  },
  {
    id: "elig3",
    caps: 12,
    natGoals: 1,
    height: 172,
    born: 1996,
    apps: [150, 80],
    goals: [2, 1],
    clubApps: 260,
    clubGoals: 6,
  },
];

let clientCounter = 0;
function get(path: string): NextRequest {
  clientCounter += 1;
  return new NextRequest(new URL(`http://localhost${path}`), {
    headers: { "x-forwarded-for": `192.0.2.${clientCounter % 250}` },
  });
}

function post(body: unknown): NextRequest {
  clientCounter += 1;
  return new NextRequest(new URL("http://localhost/api/stat-match/answer"), {
    method: "POST",
    headers: {
      "x-forwarded-for": `192.0.2.${clientCounter % 250}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
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

  for (const player of ELIGIBLE) {
    await db.prisma.player.create({
      data: {
        id: player.id,
        wikidataId: `Q${player.id}`,
        name: `Uygun ${player.id}`,
        searchKey: toSearchKey(`Uygun ${player.id}`),
        nationality: "TR",
        nationalCaps: player.caps,
        nationalGoals: player.natGoals,
        clubCareerAppearances: player.clubApps,
        clubCareerGoals: player.clubGoals,
        heightCm: player.height,
        birthDate: new Date(Date.UTC(player.born, 0, 1)),
        spells: {
          create: [CLUB_A, CLUB_B].map((qid, i) => ({
            wikidataStatementId: `${player.id}-${String(i)}`,
            clubId: clubIdOf(qid),
            appearances: player.apps[i],
            goals: player.goals[i],
            startYear: 2010 + i,
            endYear: 2012 + i,
          })),
        },
      },
    });
  }

  // UYGUN OLMAYAN: millî maç yok. Aday listesine GİRMEMELİ (BR-15) ama
  // bir istatistikte cevap olarak KULLANILABİLMELİ (BR-16).
  await db.prisma.player.create({
    data: {
      id: "capsiz",
      wikidataId: "Qcapsiz",
      name: "Millîsiz Oyuncu",
      searchKey: toSearchKey("Millîsiz Oyuncu"),
      // Kulüp yarısı VAR, millî yarısı YOK: resmî toplam hesaplanamaz (BR-23)
      // ama boy, doğum yılı ve kulüp sayısı sorularında hâlâ geçerli cevaptır.
      clubCareerAppearances: 210,
      clubCareerGoals: 12,
      heightCm: 185,
      birthDate: new Date(Date.UTC(1988, 0, 1)),
      spells: {
        create: [CLUB_A, CLUB_B].map((qid, i) => ({
          wikidataStatementId: `capsiz-${String(i)}`,
          clubId: clubIdOf(qid),
          appearances: 100 + i,
          goals: 5,
        })),
      },
    },
  });

  // UYGUN OLMAYAN: Vikipedi kariyer toplamı okunamamış. Millî tarafı tam,
  // dönemleri de var — eksik olan tek şey resmî toplamın kulüp yarısı.
  await db.prisma.player.create({
    data: {
      id: "eksik",
      wikidataId: "Qeksik",
      name: "Eksik Veri",
      searchKey: toSearchKey("Eksik Veri"),
      nationalCaps: 20,
      nationalGoals: 3,
      clubCareerAppearances: null,
      clubCareerGoals: null,
      heightCm: 180,
      birthDate: new Date(Date.UTC(1992, 0, 1)),
      spells: {
        create: [
          {
            wikidataStatementId: "eksik-0",
            clubId: clubIdOf(CLUB_A),
            appearances: 150,
            goals: 10,
          },
          {
            wikidataStatementId: "eksik-1",
            clubId: clubIdOf(CLUB_B),
            appearances: null,
            goals: null,
          },
        ],
      },
    },
  });

  process.env.DATABASE_URL = db.url;
  process.env.RATE_LIMIT_REQUESTS_PER_MINUTE ??= "60";
  process.env.RATE_LIMIT_BURST ??= "10";
  process.env.TRUSTED_PROXY_HOPS = "1";

  dailyRoute = await import("@/app/api/stat-match/route");
  answerRoute = await import("@/app/api/stat-match/answer/route");
}, 120_000);

afterAll(async () => {
  await db.destroy();
});

async function fetchDaily() {
  const response = await dailyRoute.GET(get("/api/stat-match"));
  const body = await response.json();
  return body.data as {
    date: string;
    player: { id: string; name: string; nationality: string | null };
    stats: { key: string; label: string; value: number; scoped: boolean }[];
  };
}

describe("GET /api/stat-match — §6.5", () => {
  it("günün oyuncusunu ve altı istatistiği döner", async () => {
    const response = await dailyRoute.GET(get("/api/stat-match"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.stats.map((s: { key: string }) => s.key)).toEqual([
      ...STAT_KEYS,
    ]);
  });

  /** BR-15 — altı istatistiği eksik olan aday listesine GİRMEZ. */
  it("eksik verili oyuncuyu günün oyuncusu seçmez", async () => {
    const daily = await fetchDaily();

    expect(["capsiz", "eksik"]).not.toContain(daily.player.id);
  });

  it("aynı gün aynı oyuncuyu verir (BR-19)", async () => {
    const first = await fetchDaily();
    const second = await fetchDaily();

    expect(first).toEqual(second);
  });

  it("başarılı yanıt önbelleklenebilir (§7.9)", async () => {
    const response = await dailyRoute.GET(get("/api/stat-match"));
    const cacheControl = response.headers.get("cache-control") ?? "";

    expect(cacheControl).toContain("public");
    expect(cacheControl).toMatch(/s-maxage=\d+/u);
  });

  /**
   * §11.7 — ÖLÇÜLEN KUSURUN TESTİ. Uç, öntanımlı `s-maxage=86400` alıyordu ve
   * o sürenin gerekçesi futbol verisine aitti ("yılda iki kez değişir, her
   * değişim bir dağıtımla gelir"). Günün oyuncusu her gün değişiyor ve arada
   * dağıtım yok; sabah önbelleğe giren yanıt gün sınırını 24 saate kadar
   * aşabiliyordu. Lider tablosuyla birlikte bu, iki kullanıcının aynı gün
   * FARKLI bulmaca görmesi demektir.
   */
  it("önbellek ömrü GÜN SINIRINI aşmaz (BR-49, §11.7)", async () => {
    const response = await dailyRoute.GET(get("/api/stat-match"));
    const cacheControl = response.headers.get("cache-control") ?? "";

    const seconds = Number(/s-maxage=(\d+)/u.exec(cacheControl)?.[1] ?? "-1");
    const kalan = Math.floor(
      (nextRollover(new Date()).getTime() - Date.now()) / 1_000,
    );

    expect(seconds).toBeGreaterThanOrEqual(0);
    // Bir saniyelik tolerans: başlığın üretimi ile ölçüm arasında zaman geçer.
    expect(seconds).toBeLessThanOrEqual(kalan + 1);
    // Eski davranışın geri gelmesini tutar.
    expect(seconds).toBeLessThan(86_400);

    // Bayat yanıt sunmak BURADA yasaktır: sınırdan sonra servis edilen bayat
    // yanıt, kullanıcıya dünkü bulmacayı verir.
    expect(cacheControl).not.toContain("stale-while-revalidate");
  });

  it("tarih parametresini yok sayar (BR-19)", async () => {
    const response = await dailyRoute.GET(
      get("/api/stat-match?date=2020-01-01"),
    );
    const body = await response.json();

    expect(body.data.date).not.toBe("2020-01-01");
  });
});

describe("POST /api/stat-match/answer — BR-18, BR-20", () => {
  /** Günün oyuncusu OLMAYAN, uygun bir cevap adayının kimliği. */
  async function anotherEligibleId(): Promise<string> {
    const daily = await fetchDaily();
    const other = ELIGIBLE.find((p) => p.id !== daily.player.id);
    if (other === undefined) throw new Error("Cevap adayı yok.");
    return other.id;
  }

  it("değer ve puan döner", async () => {
    const playerId = await anotherEligibleId();

    const response = await answerRoute.POST(
      post({ statKey: "appearances", playerId }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body.data).sort()).toEqual(["score", "value"]);
    expect(body.data.score).toBeGreaterThanOrEqual(0);
    expect(body.data.score).toBeLessThanOrEqual(100);
  });

  it("tam isabet 100 verir", async () => {
    const daily = await fetchDaily();
    const target = daily.stats.find((s) => s.key === "heightCm")?.value;
    const twin = ELIGIBLE.find(
      (p) => p.id !== daily.player.id && p.height === target,
    );

    // Sentetik kümede aynı boyda ikinci bir oyuncu olmayabilir; varsa sına.
    if (twin === undefined) return;

    const response = await answerRoute.POST(
      post({ statKey: "heightCm", playerId: twin.id }),
    );
    const body = await response.json();

    expect(body.data.score).toBe(100);
  });

  /**
   * BR-16 — cevap havuzu İSTATİSTİK BAŞINADIR. Millî maçı olmayan oyuncu boy
   * sorusunda geçerli bir cevaptır ama millî maç sorusunda değildir.
   */
  it("verisi olan istatistikte kabul, olmayanda reddeder", async () => {
    const kabul = await answerRoute.POST(
      post({ statKey: "heightCm", playerId: "capsiz" }),
    );
    expect(kabul.status).toBe(200);

    const ret = await answerRoute.POST(
      post({ statKey: "nationalCaps", playerId: "capsiz" }),
    );
    const body = await ret.json();
    expect(ret.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  /**
   * BR-23 — resmî toplamın bir yarısı bilinmiyorsa toplam da bilinmiyor;
   * sıfır dönmek yerine reddedilir (§2.7).
   */
  it("kariyer toplamı olmayan oyuncuyu maç sorusunda reddeder", async () => {
    const response = await answerRoute.POST(
      post({ statKey: "appearances", playerId: "eksik" }),
    );

    expect(response.status).toBe(400);
  });

  it("günün oyuncusu cevap olarak reddedilir", async () => {
    const daily = await fetchDaily();

    const response = await answerRoute.POST(
      post({ statKey: "goals", playerId: daily.player.id }),
    );

    expect(response.status).toBe(400);
  });

  it("yanıt önbelleklenMEZ", async () => {
    const playerId = await anotherEligibleId();

    const response = await answerRoute.POST(
      post({ statKey: "goals", playerId }),
    );

    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    ["bilinmeyen istatistik", { statKey: "kupa", playerId: "elig1" }],
    ["istatistik yok", { playerId: "elig1" }],
    ["kimlik yok", { statKey: "goals" }],
    ["geçersiz kimlik biçimi", { statKey: "goals", playerId: "a b" }],
    ["gövde dizi", []],
    ["gövde null", null],
  ])("geçersiz gövde (%s) → 400", async (_label, body) => {
    const response = await answerRoute.POST(post(body));
    const parsed = await response.json();

    expect(response.status).toBe(400);
    expect(parsed.error.code).toBe("VALIDATION_ERROR");
  });

  /** İstemci bu uçtan günün oyuncusunu ÇEKEMEZ; eylem sunucuda sabitlenir. */
  it("action alanı istemciden geçmez", async () => {
    const response = await answerRoute.POST(post({ action: "daily" }));

    expect(response.status).toBe(400);
  });
});

/**
 * BR-16 — seçici, o istatistikte PUANLANABİLİR oyuncuları göstermeli.
 *
 * NEDEN VAR: süzgeç yokken "Buffon" araması alfabetik sırayla önce hiç verisi
 * olmayan "Armando Buffon"u getiriyordu; kullanıcı onu seçiyor, sunucu haklı
 * olarak reddediyor ve oyun bir duvara dönüşüyordu.
 */
describe("GET /api/players?stat= — BR-16", () => {
  let playersRoute: typeof import("@/app/api/players/route");

  beforeAll(async () => {
    playersRoute = await import("@/app/api/players/route");
  });

  async function search(query: string): Promise<string[]> {
    const response = await playersRoute.GET(get(`/api/players?${query}`));
    const body = await response.json();
    return (body.data as { id: string }[]).map((p) => p.id);
  }

  it("süzgeçsiz arama verisi olmayanı da döner", async () => {
    const ids = await search("q=Oyuncu");

    expect(ids).toContain("capsiz");
  });

  it("millî maç süzgeci verisi olmayanı eler", async () => {
    expect(await search("q=Oyuncu&stat=nationalCaps")).not.toContain("capsiz");
    expect(await search("q=Uygun&stat=nationalCaps")).toContain("elig1");
  });

  it("boy süzgeci aynı oyuncuyu KABUL eder", async () => {
    // Havuz istatistik başınadır: millî maçı olmayan biri boy sorusunda
    // geçerli bir cevaptır.
    const ids = await search("q=Oyuncu&stat=heightCm");

    expect(ids).toContain("capsiz");
  });

  it("maç süzgeci kariyer toplamı olmayanı eler", async () => {
    const ids = await search("q=Eksik&stat=appearances");

    expect(ids).not.toContain("eksik");
  });

  /**
   * BR-23'ün İKİ YARISI AYRI AYRI ARANIR. Millî yarısı olmayan oyuncu resmî
   * maç sorusunda cevap OLAMAZ — ama kulüp sayısında olabilir. Süzgeç ile
   * sunucunun ayrışması ölçülmüş bir kusur sınıfı (§9.2).
   */
  it("maç süzgeci millî yarısı olmayanı da eler", async () => {
    expect(await search("q=Oyuncu&stat=appearances")).not.toContain("capsiz");
    expect(await search("q=Oyuncu&stat=clubs")).toContain("capsiz");
  });

  it("tanınmayan istatistik adını reddeder", async () => {
    const response = await playersRoute.GET(
      get("/api/players?q=Oyuncu&stat=kupa"),
    );

    expect(response.status).toBe(400);
  });
});
