import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * §7.18 — yayına açma anahtarı, gizlilik bildirimini TAMAMLANMIŞ olmaya zorlar.
 *
 * KVKK m.10 başvurulacak bir adres ister; adressiz bir aydınlatma metni
 * eksiktir. Bu kural bir yorumla değil, ORTAM DOĞRULAMASIYLA tutuluyor —
 * yorumlar unutulur, doğrulama unutulmaz.
 *
 * `serverEnv()` değeri modül düzeyinde önbelleğe aldığı için her senaryo
 * modülleri sıfırlayıp yeniden içe aktarır (robots testiyle aynı gerekçe).
 */

const BASE_ENV = {
  DATABASE_URL: "file:./dev.db",
  RATE_LIMIT_REQUESTS_PER_MINUTE: "60",
  RATE_LIMIT_BURST: "10",
};

async function loadEnv(overrides: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    vi.stubEnv(key, value);
  }
  const envModule = await import("@/infrastructure/config/env");
  return envModule.serverEnv();
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("CONTACT_EMAIL — SITE_INDEXABLE ile kenetli", () => {
  it("indekslemeye AÇILIRKEN adres yoksa uygulama BAŞLAMAZ", async () => {
    // Asıl korunan şey bu: adressiz bir bildirimle yayına çıkmak. Kural
    // olmasaydı arıza sessiz olurdu — site açılır, metin eksik kalırdı.
    await expect(loadEnv({ SITE_INDEXABLE: "true" })).rejects.toThrow(
      /CONTACT_EMAIL/u,
    );
  });

  it("hata mesajı NEDEN gerektiğini söyler", async () => {
    // "zorunlu" demek yetmez; okuyanın §7.18'e gidebilmesi gerekir.
    await expect(loadEnv({ SITE_INDEXABLE: "true" })).rejects.toThrow(
      /§7\.18/u,
    );
  });

  it("adres verilince açılır", async () => {
    const env = await loadEnv({
      SITE_INDEXABLE: "true",
      CONTACT_EMAIL: "iletisim@ornek.com",
    });

    expect(env.SITE_INDEXABLE).toBe(true);
    expect(env.CONTACT_EMAIL).toBe("iletisim@ornek.com");
  });

  it("site KAPALIYKEN adres gerekmez", async () => {
    // Geliştirici makinesinde ve CI'da engel olmamalı; kural yalnızca yayına
    // açma anında bağlar (§7.11 ile aynı yön).
    const env = await loadEnv({ SITE_INDEXABLE: "false" });

    expect(env.CONTACT_EMAIL).toBeUndefined();
  });

  it("hiç yapılandırma yokken de geçer — varsayılan kapalı", async () => {
    const env = await loadEnv({});

    expect(env.SITE_INDEXABLE).toBe(false);
    expect(env.CONTACT_EMAIL).toBeUndefined();
  });

  it("geçersiz biçimli adres kabul EDİLMEZ", async () => {
    // Yayımlanacak bir adres; bozuk olması "adres yok" ile aynı sonucu verir.
    await expect(
      loadEnv({ SITE_INDEXABLE: "true", CONTACT_EMAIL: "eposta-degil" }),
    ).rejects.toThrow(/Ortam yapılandırması geçersiz/u);
  });
});
