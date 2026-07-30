import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GRID_CLUB_QIDS } from "@/application/game-modes/grid/pool";
import { GRID_SIZE } from "@/domain/services/grid";
import { toSearchKey } from "@/domain/value-objects/search-key";
import {
  createTestDatabase,
  type TestDatabase,
} from "../helpers/test-database";

/**
 * Izgara uçlarının sözleşme testleri — PROJECT.md §6.4, §9.1.
 *
 * Route handler'lar GERÇEKTEN çağrılır: `next/server` isteği, gerçek Zod
 * şeması, gerçek Prisma deposu, gerçek hız sınırlayıcı.
 *
 * VERİ KÜMESİ SENTETİKTİR ama havuzun GERÇEK QID'lerini kullanır: üretim
 * kulüpleri havuzdan çekiyor ve QID eşleşmezse hiçbir ızgara kurulamaz. Yani
 * bu test aynı zamanda havuz→veri eşlemesinin çalıştığını da denetler.
 */

let db: TestDatabase;
let gridRoute: typeof import("@/app/api/grid/route");
let answerRoute: typeof import("@/app/api/grid/answer/route");
let playersRoute: typeof import("@/app/api/players/route");

/** Üretim en az `GRID_SIZE + 1` kulüp ister; altı, seçim yapılabilecek kadar. */
const CLUB_COUNT = 6;
/** BR-9 alt sınırının (5) hemen üstü. */
const PER_PAIR = 6;

const clubQids = GRID_CLUB_QIDS.slice(0, CLUB_COUNT);
const clubIdOf = (qid: string) => `club-${qid}`;

/** `Q…` çiftinden üretilmiş oyuncuların kimlikleri. */
const playersByPair = new Map<string, string[]>();
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

let clientCounter = 0;
function get(path: string): NextRequest {
  clientCounter += 1;
  return new NextRequest(new URL(`http://localhost${path}`), {
    headers: { "x-forwarded-for": `198.51.100.${clientCounter % 250}` },
  });
}

function post(path: string, body: unknown): NextRequest {
  clientCounter += 1;
  return new NextRequest(new URL(`http://localhost${path}`), {
    method: "POST",
    headers: {
      "x-forwarded-for": `198.51.100.${clientCounter % 250}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  db = createTestDatabase();

  await db.prisma.club.createMany({
    data: clubQids.map((qid) => ({
      id: clubIdOf(qid),
      wikidataId: qid,
      name: `Kulüp ${qid}`,
      shortName: `Kulüp ${qid}`,
      searchKey: toSearchKey(`Kulüp ${qid}`),
      country: "TR",
      isSelectable: true,
    })),
  });

  // Her kulüp ÇİFTİ için tam `PER_PAIR` ortak oyuncu: böylece her
  // kulüp×kulüp hücresinin cevap sayısı bilinir ve BR-9 bandındadır.
  let sequence = 0;
  for (let i = 0; i < clubQids.length; i++) {
    for (let j = i + 1; j < clubQids.length; j++) {
      const a = clubQids[i];
      const b = clubQids[j];
      if (a === undefined || b === undefined) continue;

      const ids: string[] = [];
      for (let n = 0; n < PER_PAIR; n++) {
        sequence += 1;
        const id = `player${String(sequence)}`;
        const name = `Oyuncu ${String(sequence)}`;
        await db.prisma.player.create({
          data: {
            id,
            wikidataId: `QP${String(sequence)}`,
            name,
            searchKey: toSearchKey(name),
            // Havuzdaki ülke kodlarından biri DEĞİL: satırların kulüp olduğu
            // bir ızgara kurulsun ki beklenen sonuç tek anlamlı olsun.
            nationality: "ZW",
            position: "Forvet",
            spells: {
              create: [
                {
                  wikidataStatementId: `s${String(sequence)}a`,
                  clubId: clubIdOf(a),
                  startYear: 2010,
                  endYear: 2012,
                },
                {
                  wikidataStatementId: `s${String(sequence)}b`,
                  clubId: clubIdOf(b),
                  startYear: 2013,
                  endYear: 2015,
                },
              ],
            },
          },
        });
        ids.push(id);
      }
      playersByPair.set(pairKey(a, b), ids);
    }
  }

  // Rotalar modül yükleme anında ortamı okur; import ÖNCE yapılandırılmalı.
  process.env.DATABASE_URL = db.url;
  process.env.RATE_LIMIT_REQUESTS_PER_MINUTE ??= "60";
  process.env.RATE_LIMIT_BURST ??= "10";
  process.env.TRUSTED_PROXY_HOPS = "1";

  gridRoute = await import("@/app/api/grid/route");
  answerRoute = await import("@/app/api/grid/answer/route");
  playersRoute = await import("@/app/api/players/route");
}, 120_000);

afterAll(async () => {
  await db.destroy();
});

interface CriterionBody {
  kind: string;
  label: string;
}

async function fetchGrid(): Promise<{
  date: string;
  rows: CriterionBody[];
  columns: CriterionBody[];
}> {
  const response = await gridRoute.GET(get("/api/grid"));
  const body = await response.json();
  return body.data;
}

describe("GET /api/grid — §6.4", () => {
  it("üç satır ve üç sütun döner", async () => {
    const response = await gridRoute.GET(get("/api/grid"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body.data.rows).toHaveLength(GRID_SIZE);
    expect(body.data.columns).toHaveLength(GRID_SIZE);
  });

  /**
   * SIZINTI KURALI (§9.1): yanıt cevapları da, hücre başına cevap SAYISINI da
   * taşımaz. Kriterin kimliği (kulüp kimliği, ülke kodu) de dışarı çıkmaz —
   * çıksaydı istemci kesişimi kendisi hesaplayabilirdi.
   */
  it("yalnızca kriter etiketlerini taşır", async () => {
    const data = await fetchGrid();

    expect(Object.keys(data).sort()).toEqual(["columns", "date", "rows"]);
    for (const criterion of [...data.rows, ...data.columns]) {
      expect(Object.keys(criterion).sort()).toEqual(["kind", "label"]);
    }
  });

  it("aynı gün aynı ızgarayı verir (BR-11)", async () => {
    expect(await fetchGrid()).toEqual(await fetchGrid());
  });

  it("başarılı yanıt CDN'de önbelleklenebilir (§7.9)", async () => {
    const response = await gridRoute.GET(get("/api/grid"));
    const cacheControl = response.headers.get("cache-control") ?? "";

    expect(cacheControl).toContain("public");
    expect(cacheControl).toMatch(/s-maxage=\d+/u);
  });

  /** İstemci gün seçemez; seçebilseydi yarının ızgarasını bugünden çekerdi. */
  it("tarih parametresini yok sayar", async () => {
    const withDate = await gridRoute.GET(get("/api/grid?date=2020-01-01"));
    const body = await withDate.json();

    expect(withDate.status).toBe(200);
    expect(body.data.date).not.toBe("2020-01-01");
  });
});

describe("POST /api/grid/answer — BR-12", () => {
  /** Izgaranın gerçek 0,0 hücresine ait doğru bir cevabın kimliği. */
  async function correctAnswerForFirstCell(): Promise<string> {
    const response = await gridRoute.GET(get("/api/grid"));
    const body = await response.json();

    // Etiket "Kulüp Q…" biçiminde; QID'i etiketten geri okuyoruz. Kimlik
    // yanıta ÇIKMADIĞI için (sızıntı kuralı) başka yolu yok — ve bu, kuralın
    // gerçekten uygulandığının da kanıtı.
    const rowQid = String(body.data.rows[0].label).replace("Kulüp ", "");
    const columnQid = String(body.data.columns[0].label).replace("Kulüp ", "");

    const ids = playersByPair.get(pairKey(rowQid, columnQid));
    if (ids?.[0] === undefined) {
      throw new Error(
        `Bu çift için oyuncu üretilmedi: ${rowQid}, ${columnQid}`,
      );
    }
    return ids[0];
  }

  it("iki kriteri de sağlayan cevap için correct:true döner", async () => {
    const playerId = await correctAnswerForFirstCell();

    const response = await answerRoute.POST(
      post("/api/grid/answer", { cell: { row: 0, column: 0 }, playerId }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ correct: true });
  });

  it("başka hücreye ait cevap için correct:false döner", async () => {
    const playerId = await correctAnswerForFirstCell();

    const response = await answerRoute.POST(
      post("/api/grid/answer", { cell: { row: 1, column: 1 }, playerId }),
    );
    const body = await response.json();

    expect(body.data).toEqual({ correct: false });
  });

  /**
   * Var olmayan kimlik 404 DEĞİL, "yanlış cevap"tır: 404 dönmek hangi
   * kimliklerin var olduğunu ayırt etmeyi — yani numaralandırmayı — mümkün
   * kılardı.
   */
  it("var olmayan oyuncu kimliği correct:false döner", async () => {
    const response = await answerRoute.POST(
      post("/api/grid/answer", {
        cell: { row: 0, column: 0 },
        playerId: "boyle-bir-oyuncu-yok",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ correct: false });
  });

  /**
   * Cevap denemeleri kullanıcının oyun ilerleyişidir; paylaşılan bir önbelleğe
   * girmemeli (§7.9).
   */
  it("yanıt önbelleklenMEZ", async () => {
    const response = await answerRoute.POST(
      post("/api/grid/answer", {
        cell: { row: 0, column: 0 },
        playerId: "abc",
      }),
    );

    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    ["aralık dışı satır", { cell: { row: 3, column: 0 }, playerId: "a" }],
    ["negatif sütun", { cell: { row: 0, column: -1 }, playerId: "a" }],
    ["ondalıklı hücre", { cell: { row: 0.5, column: 0 }, playerId: "a" }],
    ["hücre yok", { playerId: "a" }],
    ["kimlik yok", { cell: { row: 0, column: 0 } }],
    [
      "geçersiz kimlik biçimi",
      { cell: { row: 0, column: 0 }, playerId: "a b" },
    ],
    ["gövde dizi", []],
    ["gövde null", null],
  ])("geçersiz gövde (%s) → 400", async (_label, body) => {
    const response = await answerRoute.POST(post("/api/grid/answer", body));
    const parsed = await response.json();

    expect(response.status).toBe(400);
    expect(parsed.error.code).toBe("VALIDATION_ERROR");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  /** Bozuk gövde bir GİRDİ hatasıdır; 500 dönmek sunucu kusuru ima ederdi. */
  it("JSON olmayan gövde → 400, 500 değil", async () => {
    clientCounter += 1;
    const request = new NextRequest(
      new URL("http://localhost/api/grid/answer"),
      {
        method: "POST",
        headers: {
          "x-forwarded-for": "198.51.100.201",
          "content-type": "application/json",
        },
        body: "{bozuk",
      },
    );

    const response = await answerRoute.POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  /** İstemci bu uçtan ızgara ÇEKEMEZ; eylem sunucuda sabitlenir. */
  it("action alanı istemciden geçmez", async () => {
    const response = await answerRoute.POST(
      post("/api/grid/answer", { action: "daily" }),
    );

    expect(response.status).toBe(400);
  });
});

describe("GET /api/players — §6.4", () => {
  it("ada göre eşleşen oyuncuları döner", async () => {
    const response = await playersRoute.GET(get("/api/players?q=Oyuncu"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.length).toBeGreaterThan(0);
  });

  /**
   * Oyuncunun kulüp geçmişi yanıta ÇIKMAZ: çıksaydı arama kutusu ızgaranın
   * cevap anahtarına dönüşürdü (§9.1).
   */
  it("yanıt kulüp geçmişi taşımaz", async () => {
    const response = await playersRoute.GET(get("/api/players?q=Oyuncu"));
    const body = await response.json();

    expect(Object.keys(body.data[0]).sort()).toEqual([
      "id",
      "name",
      "nationality",
      "position",
    ]);
    expect(body.data[0]).not.toHaveProperty("spells");
    expect(body.data[0]).not.toHaveProperty("searchKey");
    expect(body.data[0]).not.toHaveProperty("wikidataId");
  });

  it("kısa metinde boş liste döner", async () => {
    const response = await playersRoute.GET(get("/api/players?q=O"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it("limit'e uyar", async () => {
    const response = await playersRoute.GET(
      get("/api/players?q=Oyuncu&limit=3"),
    );
    const body = await response.json();

    expect(body.data).toHaveLength(3);
  });

  it.each([
    ["q yok", "/api/players"],
    ["q çok uzun", `/api/players?q=${"a".repeat(51)}`],
    ["limit sıfır", "/api/players?q=Oyuncu&limit=0"],
    ["limit üst sınırın üstünde", "/api/players?q=Oyuncu&limit=21"],
    ["limit sayı değil", "/api/players?q=Oyuncu&limit=abc"],
  ])("geçersiz girdi (%s) → 400", async (_label, path) => {
    const response = await playersRoute.GET(get(path));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
