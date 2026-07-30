import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { toSearchKey } from "@/domain/value-objects/search-key";
import {
  createTestDatabase,
  type TestDatabase,
} from "../helpers/test-database";

/**
 * Sözleşme testleri — PROJECT.md §8.1, §6.
 *
 * Route handler'lar GERÇEKTEN çağrılır: sahte bir katman değil, `next/server`
 * isteği, gerçek Zod şeması, gerçek Prisma deposu, gerçek hız sınırlayıcı.
 * Sözleşme testinin değeri buradan gelir — sarmalayıcıyı taklit eden bir test,
 * uçların gerçekten §6'ya uyduğunu söyleyemezdi.
 *
 * Hız sınırlayıcı süreç genelinde tekildir; testler birbirinin kotasını
 * tüketmesin diye her test KENDİ istemci IP'sini kullanır.
 */

let db: TestDatabase;
let clubsRoute: typeof import("@/app/api/clubs/route");
let commonPlayersRoute: typeof import("@/app/api/common-players/route");

const CLUB_A = "clubGalatasaray";
const CLUB_B = "clubArsenal";

/** Her test için benzersiz istemci — ayrı hız sınırı kovası. */
let clientCounter = 0;
function request(path: string): NextRequest {
  clientCounter += 1;
  return new NextRequest(new URL(`http://localhost${path}`), {
    headers: { "x-forwarded-for": `203.0.113.${clientCounter % 250}` },
  });
}

beforeAll(async () => {
  db = createTestDatabase();

  await db.prisma.club.createMany({
    data: [
      {
        id: CLUB_A,
        wikidataId: "Q495299",
        name: "Galatasaray Spor Kulübü",
        shortName: "Galatasaray",
        searchKey: toSearchKey("Galatasaray Spor Kulübü"),
        country: "TR",
        crestUrl: "https://upload.wikimedia.org/gs.png",
        isSelectable: true,
      },
      {
        id: CLUB_B,
        wikidataId: "Q9617",
        name: "Arsenal F.C.",
        shortName: "Arsenal",
        searchKey: toSearchKey("Arsenal F.C."),
        country: "GB",
        isSelectable: true,
      },
      {
        id: "clubGizli",
        wikidataId: "Q1",
        name: "Olympique Lillois",
        shortName: "Lillois",
        searchKey: toSearchKey("Olympique Lillois"),
        isSelectable: false,
      },
    ],
  });

  await db.prisma.player.create({
    data: {
      id: "pEboue",
      wikidataId: "Q192856",
      name: "Emmanuel Eboué",
      searchKey: toSearchKey("Emmanuel Eboué"),
      nationality: "CI",
      position: "Defans",
      spells: {
        create: [
          {
            wikidataStatementId: "s1",
            clubId: CLUB_A,
            startYear: 2011,
            endYear: 2014,
            appearances: 64,
            goals: 3,
          },
          {
            wikidataStatementId: "s2",
            clubId: CLUB_B,
            startYear: 2005,
            endYear: 2011,
            appearances: 214,
            goals: 9,
          },
        ],
      },
    },
  });

  // Rotalar modül yükleme anında ortamı okur; import ÖNCE yapılandırılmalı.
  process.env.DATABASE_URL = db.url;
  process.env.RATE_LIMIT_REQUESTS_PER_MINUTE ??= "60";
  process.env.RATE_LIMIT_BURST ??= "10";
  process.env.TRUSTED_PROXY_HOPS = "1";

  clubsRoute = await import("@/app/api/clubs/route");
  commonPlayersRoute = await import("@/app/api/common-players/route");
}, 60_000);

afterAll(async () => {
  await db.destroy();
});

describe("GET /api/clubs — §6.1", () => {
  it("seçilebilir kulüpleri `data` sarmalayıcısıyla döner", async () => {
    const response = await clubsRoute.GET(request("/api/clubs"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.map((c: { shortName: string }) => c.shortName)).toEqual([
      "Arsenal",
      "Galatasaray",
    ]);
  });

  it("yanıt yalnızca §6.1'deki alanları taşır", async () => {
    const response = await clubsRoute.GET(request("/api/clubs?q=Galatasaray"));
    const body = await response.json();

    expect(Object.keys(body.data[0]).sort()).toEqual([
      "country",
      "crestUrl",
      "id",
      "name",
      "shortName",
    ]);
    // Veritabanı satırındaki iç alanlar dışarı çıkmaz (§2.4).
    expect(body.data[0]).not.toHaveProperty("searchKey");
    expect(body.data[0]).not.toHaveProperty("isSelectable");
    expect(body.data[0]).not.toHaveProperty("wikidataId");
  });

  it("seçilemez kulübü aramayla bile döndürmez", async () => {
    const response = await clubsRoute.GET(request("/api/clubs?q=Lillois"));
    const body = await response.json();

    expect(body.data).toEqual([]);
  });

  it("Türkçe arama çalışır", async () => {
    const response = await clubsRoute.GET(
      request(`/api/clubs?q=${encodeURIComponent("galatasaray")}`),
    );
    const body = await response.json();

    expect(body.data).toHaveLength(1);
  });

  it("başarılı yanıt CDN'de önbelleklenebilir (§7.9)", async () => {
    const response = await clubsRoute.GET(request("/api/clubs"));
    const cacheControl = response.headers.get("cache-control") ?? "";

    // Veri yalnızca yeni bir dağıtımla değişir; kişiselleştirme yok.
    expect(cacheControl).toContain("public");
    expect(cacheControl).toMatch(/s-maxage=\d+/u);
    expect(cacheControl).not.toContain("no-store");
  });

  it("geçersiz istek önbelleklenMEZ", async () => {
    const response = await clubsRoute.GET(request("/api/clubs?limit=0"));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    ["q çok uzun", `/api/clubs?q=${"a".repeat(51)}`],
    ["limit sıfır", "/api/clubs?limit=0"],
    ["limit üst sınırın üstünde", "/api/clubs?limit=51"],
    ["limit sayı değil", "/api/clubs?limit=abc"],
    ["limit negatif", "/api/clubs?limit=-5"],
  ])("geçersiz girdi (%s) → 400 VALIDATION_ERROR", async (_label, path) => {
    const response = await clubsRoute.GET(request(path));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(typeof body.error.traceId).toBe("string");
  });

  it("bilinmeyen parametreleri yok sayar", async () => {
    const response = await clubsRoute.GET(
      request("/api/clubs?bilinmeyen=1&q=Arsenal"),
    );

    expect(response.status).toBe(200);
  });

  it("limit'e uyar", async () => {
    const response = await clubsRoute.GET(request("/api/clubs?limit=1"));
    const body = await response.json();

    expect(body.data).toHaveLength(1);
  });
});

describe("GET /api/common-players — §6.2", () => {
  it("§6.2'deki yanıt şeklini üretir", async () => {
    const response = await commonPlayersRoute.GET(
      request(`/api/common-players?clubA=${CLUB_A}&clubB=${CLUB_B}`),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.clubA.shortName).toBe("Galatasaray");
    expect(body.data.clubB.shortName).toBe("Arsenal");
    expect(body.data.count).toBe(1);
    expect(body.data.players[0]).toMatchObject({
      name: "Emmanuel Eboué",
      nationality: "CI",
      position: "Defans",
    });
    expect(body.data.players[0].spellsAtA[0]).toEqual({
      startYear: 2011,
      endYear: 2014,
      isLoan: false,
      appearances: 64,
      goals: 3,
      hasEvidence: true,
    });
  });

  it("BR-4: aynı kulüp → 400", async () => {
    const response = await commonPlayersRoute.GET(
      request(`/api/common-players?clubA=${CLUB_A}&clubB=${CLUB_A}`),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("İki farklı kulüp seçilmelidir.");
  });

  it("bilinmeyen kulüp → 404 NOT_FOUND", async () => {
    const response = await commonPlayersRoute.GET(
      request(`/api/common-players?clubA=${CLUB_A}&clubB=yokBoyleKulup`),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it.each([
    ["clubA eksik", `/api/common-players?clubB=${CLUB_B}`],
    ["clubB eksik", `/api/common-players?clubA=${CLUB_A}`],
    ["ikisi de eksik", "/api/common-players"],
    [
      "geçersiz kimlik biçimi",
      `/api/common-players?clubA=a%20b&clubB=${CLUB_B}`,
    ],
    [
      "includeYouth geçersiz",
      `/api/common-players?clubA=${CLUB_A}&clubB=${CLUB_B}&includeYouth=belki`,
    ],
    [
      "includeLoans boş",
      `/api/common-players?clubA=${CLUB_A}&clubB=${CLUB_B}&includeLoans=`,
    ],
  ])("geçersiz girdi (%s) → 400", async (_label, path) => {
    const response = await commonPlayersRoute.GET(request(path));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("hata gövdesi §6.3 biçiminde ve fazlası yok", async () => {
    const response = await commonPlayersRoute.GET(
      request("/api/common-players"),
    );
    const body = await response.json();

    expect(Object.keys(body)).toEqual(["error"]);
    expect(Object.keys(body.error).sort()).toEqual([
      "code",
      "message",
      "traceId",
    ]);
  });

  it("hata gövdesi yığın izi veya dosya yolu sızdırmaz", async () => {
    const response = await commonPlayersRoute.GET(
      request("/api/common-players?clubA=!!&clubB=??"),
    );
    const text = await response.text();

    expect(text).not.toMatch(/\.ts|node_modules|at\s+\w+\s+\(/u);
    expect(text).not.toMatch(/SELECT|prisma|SQLITE/iu);
  });

  it("her yanıtta farklı bir traceId üretilir", async () => {
    const first = await (
      await commonPlayersRoute.GET(request("/api/common-players"))
    ).json();
    const second = await (
      await commonPlayersRoute.GET(request("/api/common-players"))
    ).json();

    expect(first.error.traceId).not.toBe(second.error.traceId);
  });

  it("includeLoans=false kiralık dönemleri eler", async () => {
    const response = await commonPlayersRoute.GET(
      request(
        `/api/common-players?clubA=${CLUB_A}&clubB=${CLUB_B}&includeLoans=false`,
      ),
    );
    const body = await response.json();

    // Tohum verideki dönemler kiralık değil; sonuç değişmemeli.
    expect(response.status).toBe(200);
    expect(body.data.count).toBe(1);
  });
});

describe("hız sınırı — §7.5", () => {
  it("patlama aşıldığında 429 ve Retry-After döner", async () => {
    // Bu test tek bir istemci kimliği kullanır: kovayı bilerek tüketiyoruz.
    const client = "198.51.100.42";
    const burst = Number(process.env.RATE_LIMIT_BURST ?? "10");

    const send = () =>
      clubsRoute.GET(
        new NextRequest(new URL("http://localhost/api/clubs"), {
          headers: { "x-forwarded-for": client },
        }),
      );

    let limited: Response | undefined;
    for (let i = 0; i < burst + 5; i++) {
      const response = await send();
      if (response.status === 429) {
        limited = response;
        break;
      }
    }

    expect(limited, "hız sınırı hiç devreye girmedi").toBeDefined();
    expect(limited?.status).toBe(429);

    const retryAfter = limited?.headers.get("retry-after");
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);

    const body = await limited?.json();
    expect(body.error.code).toBe("RATE_LIMITED");

    // §7.9 — EN KRİTİK ÖNBELLEK KURALI. Önbelleklenmiş bir 429, sınırı hiç
    // aşmamış istemcilere de servis edilirdi; hız sınırlayıcı o noktada
    // masumları engelleyen bir araca dönüşür.
    expect(limited?.headers.get("cache-control")).toBe("no-store");
  });

  it("bir istemcinin sınırı diğerini etkilemez", async () => {
    const response = await clubsRoute.GET(
      new NextRequest(new URL("http://localhost/api/clubs"), {
        headers: { "x-forwarded-for": "198.51.100.99" },
      }),
    );

    expect(response.status).toBe(200);
  });
});
