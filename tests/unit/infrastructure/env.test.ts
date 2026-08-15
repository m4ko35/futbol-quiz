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

/**
 * §11 — hesap yapılandırması YA TAM YA HİÇ.
 *
 * Tehlikeli olan hâl "hiç yok" değil YARIM: site açılır, "Google ile gir"
 * düğmesi görünür ve akış ortasında patlar. Kullanıcı için bu, çalışmayan bir
 * siteden daha kötü — çalışıyor sanıp deniyor.
 */
const ACCOUNT_ENV = {
  ACCOUNTS_DATABASE_URL: "libsql://ornek.turso.io",
  ACCOUNTS_DATABASE_TOKEN: "belirtec",
  GOOGLE_CLIENT_ID: "istemci.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "GOCSPX-sir",
  AUTH_SECRET: "a".repeat(43),
};

async function loadAccounts(overrides: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    vi.stubEnv(key, value);
  }
  return import("@/infrastructure/config/env");
}

describe("hesap yapılandırması — §11", () => {
  it("hiçbiri yokken uygulama ÇALIŞIR, özellik kapalıdır", async () => {
    // Bugünkü üretim tam olarak bu hâlde; zorunlu yapmak siteyi düşürürdü.
    const mod = await loadAccounts({});

    expect(mod.accountsEnabled()).toBe(false);
    expect(mod.accountsEnv()).toBeNull();
  });

  it("beşi de varken özellik AÇIKTIR", async () => {
    const mod = await loadAccounts(ACCOUNT_ENV);

    expect(mod.accountsEnabled()).toBe(true);
    expect(mod.accountsEnv()?.googleClientId).toBe(
      ACCOUNT_ENV.GOOGLE_CLIENT_ID,
    );
  });

  it("YARIM yapılandırmada uygulama BAŞLAMAZ", async () => {
    const { AUTH_SECRET: _atilan, ...eksik } = ACCOUNT_ENV;
    const mod = await loadAccounts(eksik);

    expect(() => mod.serverEnv()).toThrow(/YARIM/u);
  });

  it("hata EKSİK OLANI söyler — aranmaz", async () => {
    // "Hesap yapılandırması eksik" demek, hangisini unuttuğunu aramaya
    // bırakır; mesaj adı vermek zorunda.
    const { GOOGLE_CLIENT_SECRET: _atilan, ...eksik } = ACCOUNT_ENV;
    const mod = await loadAccounts(eksik);

    expect(() => mod.serverEnv()).toThrow(/GOOGLE_CLIENT_SECRET/u);
  });

  it("KISA anahtar reddedilir", async () => {
    // Kısa anahtar HMAC'i tahmin edilebilir kılar; oturum imzası da `sub`
    // özeti de ona dayanıyor (§11.10).
    const mod = await loadAccounts({ ...ACCOUNT_ENV, AUTH_SECRET: "kisa" });

    expect(() => mod.serverEnv()).toThrow(/Ortam yapılandırması geçersiz/u);
  });
});
