import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * §7.11 — indeksleme anahtarı.
 *
 * `serverEnv()` değeri modül düzeyinde önbelleğe alır, bu yüzden her senaryo
 * modülleri sıfırlayıp yeniden içe aktarır. Aksi hâlde ilk testin okuduğu
 * değer diğerlerine sızar ve test, ölçtüğünü sandığı şeyi ölçmez.
 */

/**
 * `connection()` gerçek bir istek kapsamı ister; birim testinde yoktur.
 * Taklidi aynı zamanda bir ÖLÇÜM aracı: çağrılıp çağrılmadığını sayıyoruz.
 */
const connectionMock = vi.fn(() => Promise.resolve());

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: () => connectionMock(),
}));

const BASE_ENV = {
  DATABASE_URL: "file:./dev.db",
  RATE_LIMIT_REQUESTS_PER_MINUTE: "60",
  RATE_LIMIT_BURST: "10",
  // §7.18 — `SITE_INDEXABLE=true` bu adres olmadan doğrulamayı geçmez. Burada
  // geçerli bir dağıtım yapılandırmasını temsil ediyor; kenetlemenin KENDİSİ
  // `tests/unit/infrastructure/env.test.ts` içinde sınanır.
  CONTACT_EMAIL: "iletisim@ornek.com",
};

async function loadRobots(overrides: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    vi.stubEnv(key, value);
  }
  const robotsModule = await import("@/app/robots");
  return robotsModule.default();
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("robots.txt", () => {
  it("varsayılan KAPALIDIR — açıkça açılması gerekir", async () => {
    // Ortam değişkeni hiç verilmediğinde site indekslenmemeli. Varsayılanın
    // "açık" olması, unutulan bir yapılandırmanın siteyi sessizce arama
    // sonuçlarına sokması demek olurdu; tersi zararsız.
    const result = await loadRobots({});

    expect(result.rules).toEqual({ userAgent: "*", disallow: "/" });
  });

  it("SITE_INDEXABLE=false → tüm site taramaya kapalı", async () => {
    const result = await loadRobots({ SITE_INDEXABLE: "false" });

    expect(result.rules).toEqual({ userAgent: "*", disallow: "/" });
  });

  it("SITE_INDEXABLE=true → site açılır, API uçları hariç", async () => {
    const result = await loadRobots({
      SITE_INDEXABLE: "true",
      SITE_URL: "https://ornek.com",
    });

    expect(result.rules).toMatchObject({ userAgent: "*", allow: "/" });
    // API uçları insan için değil; taranmaları hız sınırını tüketir (§7.5).
    expect(result.rules).toMatchObject({ disallow: "/api/" });
    expect(result.host).toBe("https://ornek.com");
  });

  it("'false' dizgisi doğru okunur — boş olmayan her değer `true` DEĞİLDİR", async () => {
    // `z.coerce.boolean()` kullanılsaydı "false" dizgisi `true` olurdu ve
    // site, kapalı olduğunu sanırken açık olurdu.
    const kapali = await loadRobots({ SITE_INDEXABLE: "false" });
    const acik = await loadRobots({ SITE_INDEXABLE: "true" });

    expect(kapali.rules).not.toEqual(acik.rules);
  });

  /**
   * BU TESTİN VAR OLMA SEBEBİ ÖLÇÜLDÜ. Next `robots.js`'i öntanımlı olarak
   * önbelleğe alıyor ve gövdeyi derlemeye gömüyor; sayfa meta etiketi ise her
   * istekte okunuyor. Derleme `SITE_INDEXABLE` olmadan yapılıp çalışma anında
   * `true` verildiğinde `robots.txt` "Disallow: /" derken sayfa "index, follow"
   * diyordu — site kapalı kalır ama açıldığı sanılırdı (§7.11).
   *
   * `connection()` kaldırılırsa arıza sessizdir: birim testlerinin hepsi yeşil
   * kalır, çünkü işlev doğru değeri döndürmeye devam eder. Yalnızca DERLEME
   * davranışı değişir. Bu yüzden çağrının kendisi sınanıyor.
   */
  it("her istekte yeniden değerlendirilir — derlemeye gömülmez", async () => {
    connectionMock.mockClear();

    await loadRobots({ SITE_INDEXABLE: "true", SITE_URL: "https://ornek.com" });

    expect(connectionMock).toHaveBeenCalledOnce();
  });

  it("tanınmayan bir değer uygulamayı BAŞLATMAZ", async () => {
    // Yarım yapılandırmayla çalışıp yanlış cevap vermektense durmak doğrudur
    // (§7.6). "evet" gibi bir değer sessizce `false` sayılmamalı.
    await expect(loadRobots({ SITE_INDEXABLE: "evet" })).rejects.toThrow(
      /Ortam yapılandırması geçersiz/u,
    );
  });
});
