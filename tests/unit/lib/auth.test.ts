import { afterEach, describe, expect, it, vi } from "vitest";
import { exchangeCode } from "@/lib/auth/google";
import {
  authorizationUrl,
  checkIdToken,
  GOOGLE_SCOPE,
  readIdTokenClaims,
} from "@/lib/auth/oidc";
import {
  hashSubject,
  pkceChallenge,
  randomToken,
  signSession,
  timingSafeEqual,
  verifySession,
} from "@/lib/auth/secrets";
import {
  createPendingValue,
  createSessionValue,
  readPendingValue,
  readSessionValue,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";

/**
 * §11.10 — giriş akışı.
 *
 * Buradaki testlerin çoğu bir "özelliği" değil, ATLANABİLECEK BİR DENETİMİ
 * ölçüyor. Kimlik jetonunun imzası doğrulanmıyor (BR-51) ve bu, kalan dört
 * denetimin her birini vazgeçilmez kılıyor: biri düşerse akışta delik açılır.
 */

const SECRET = "a".repeat(43);
const CLIENT_ID = "istemci.apps.googleusercontent.com";
const NOW = new Date("2026-08-16T12:00:00Z");

/** Test için kimlik jetonu üretir — imza alanı DOLDURULMAZ, okunmuyor. */
function makeIdToken(claims: Record<string, unknown>): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");

  return `${encode({ alg: "RS256" })}.${encode(claims)}.imza-okunmuyor`;
}

const validClaims = {
  iss: "https://accounts.google.com",
  aud: CLIENT_ID,
  sub: "google-sub-123",
  exp: Math.floor(NOW.getTime() / 1_000) + 3_600,
  nonce: "nonce-abc",
};

describe("secrets — HMAC ve etiket ayrımı", () => {
  it("aynı girdi aynı özeti verir", async () => {
    expect(await hashSubject(SECRET, "sub-1")).toBe(
      await hashSubject(SECRET, "sub-1"),
    );
  });

  it("farklı sub farklı özet verir", async () => {
    expect(await hashSubject(SECRET, "sub-1")).not.toBe(
      await hashSubject(SECRET, "sub-2"),
    );
  });

  it("farklı ANAHTAR farklı özet verir — sızan veritabanı eşleştirilemez", async () => {
    expect(await hashSubject(SECRET, "sub-1")).not.toBe(
      await hashSubject("b".repeat(43), "sub-1"),
    );
  });

  /**
   * ETİKET AYRIMININ SEBEBİ: aynı anahtarla iki farklı şey imzalanırsa, bir
   * bağlamda üretilen imza diğerinde geçerli olabilirdi.
   */
  it("aynı metin, iki AMAÇ, iki farklı sonuç", async () => {
    const metin = "ayni-metin";

    expect(await hashSubject(SECRET, metin)).not.toBe(
      await signSession(SECRET, metin),
    );
  });

  it("imza doğrulanır, bozulmuş imza reddedilir", async () => {
    const signature = await signSession(SECRET, "govde");

    expect(await verifySession(SECRET, "govde", signature)).toBe(true);
    expect(await verifySession(SECRET, "baska-govde", signature)).toBe(false);
    expect(await verifySession("c".repeat(43), "govde", signature)).toBe(false);
  });

  it("sabit süreli karşılaştırma doğru sonucu verir", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });

  it("rastgele jeton her çağrıda farklıdır", () => {
    const uretilen = new Set(Array.from({ length: 50 }, () => randomToken()));

    expect(uretilen.size).toBe(50);
  });

  it("PKCE meydan okuması doğrulayıcıdan TÜRETİLİR", async () => {
    const dogrulayici = "dogrulayici-degeri";

    expect(await pkceChallenge(dogrulayici)).toBe(
      await pkceChallenge(dogrulayici),
    );
    expect(await pkceChallenge(dogrulayici)).not.toBe(
      await pkceChallenge("baska"),
    );
    // Özet base64url; dolgu karakteri taşımamalı.
    expect(await pkceChallenge(dogrulayici)).not.toContain("=");
  });
});

describe("yetkilendirme adresi", () => {
  const url = new URL(
    authorizationUrl({
      clientId: CLIENT_ID,
      redirectUri: "http://localhost:3000/api/auth/callback/google",
      state: "state-1",
      nonce: "nonce-1",
      codeChallenge: "meydan-1",
    }),
  );

  it("Google'ın SABİT adresine gider", () => {
    expect(url.origin).toBe("https://accounts.google.com");
  });

  /**
   * KAPSAM YALNIZCA `openid`. `email` istenseydi Google adresi bize
   * gönderirdi ve "saklamıyoruz" bir söz olurdu; istemeyince elimize hiç
   * geçmiyor (§11.3).
   */
  it("YALNIZCA openid kapsamı ister", () => {
    expect(url.searchParams.get("scope")).toBe(GOOGLE_SCOPE);
    expect(url.searchParams.get("scope")).toBe("openid");
    expect(url.searchParams.get("scope")).not.toContain("email");
    expect(url.searchParams.get("scope")).not.toContain("profile");
  });

  it("state, nonce ve PKCE taşır", () => {
    expect(url.searchParams.get("state")).toBe("state-1");
    expect(url.searchParams.get("nonce")).toBe("nonce-1");
    expect(url.searchParams.get("code_challenge")).toBe("meydan-1");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("kimlik jetonu denetimi — BR-51'in dayandığı dört kapı", () => {
  const check = (claims: Record<string, unknown>, nonce = "nonce-abc") =>
    checkIdToken({
      idToken: makeIdToken(claims),
      clientId: CLIENT_ID,
      nonce,
      now: NOW,
    });

  it("geçerli jetondan sub çıkarır", () => {
    expect(check(validClaims)).toEqual({ ok: true, subject: "google-sub-123" });
  });

  /**
   * EN KRİTİK DENETİM. `aud` bakılmazsa BAŞKA bir Google uygulaması için
   * üretilmiş jeton kabul edilir: saldırgan kendi uygulamasında kurbanı
   * oturum açtırıp jetonu bize sunar — hesap ele geçirme.
   */
  it("BAŞKA uygulamanın jetonunu reddeder", () => {
    expect(
      check({ ...validClaims, aud: "baska.apps.googleusercontent.com" }),
    ).toEqual({ ok: false, reason: "yanlis-audience" });
  });

  it("başka sağlayıcının jetonunu reddeder", () => {
    expect(
      check({ ...validClaims, iss: "https://kotu-saglayici.example" }),
    ).toEqual({ ok: false, reason: "yanlis-issuer" });
  });

  it("Google'ın İKİ issuer biçimini de kabul eder", () => {
    expect(check({ ...validClaims, iss: "accounts.google.com" }).ok).toBe(true);
  });

  it("süresi geçmiş jetonu reddeder", () => {
    expect(
      check({
        ...validClaims,
        exp: Math.floor(NOW.getTime() / 1_000) - 1,
      }),
    ).toEqual({ ok: false, reason: "suresi-gecmis" });
  });

  /**
   * `exp` SANİYE cinsinden. Milisaniyeyle karşılaştırılsaydı jeton bin kat
   * uzun geçerli görünürdü — ve test bunu yakalamasa kimse fark etmezdi.
   */
  it("exp SANİYE olarak yorumlanır", () => {
    // 1970'te dolan bir jeton: milisaniye sanılsaydı hâlâ geçerli çıkardı.
    expect(check({ ...validClaims, exp: 1 }).ok).toBe(false);
  });

  it("nonce uyuşmazsa reddeder — tekrar oynatma kapısı", () => {
    expect(check(validClaims, "baska-nonce")).toEqual({
      ok: false,
      reason: "nonce-uyusmuyor",
    });
  });

  it("nonce TAŞIMAYAN jeton reddedilir", () => {
    const { nonce: _atilan, ...nonceSiz } = validClaims;

    expect(check(nonceSiz)).toEqual({ ok: false, reason: "nonce-uyusmuyor" });
  });

  it("biçimsiz jetonu reddeder", () => {
    for (const bozuk of ["", "tek-parca", "iki.parca", "a.!!!.c"]) {
      expect(
        checkIdToken({
          idToken: bozuk,
          clientId: CLIENT_ID,
          nonce: "nonce-abc",
          now: NOW,
        }).ok,
      ).toBe(false);
    }
  });

  it("eksik iddia taşıyan jetonu reddeder", () => {
    expect(readIdTokenClaims(makeIdToken({ iss: "x" }))).toBeNull();
    expect(check({ ...validClaims, sub: "" }).ok).toBe(false);
  });
});

describe("oturum çerezi", () => {
  it("yazılan oturum okunur", async () => {
    const value = await createSessionValue(SECRET, "kullanici-1", NOW);

    expect(await readSessionValue(SECRET, value, NOW)).toBe("kullanici-1");
  });

  it("BAŞKA anahtarla imzalanmış çerez reddedilir", async () => {
    const value = await createSessionValue("z".repeat(43), "kullanici-1", NOW);

    expect(await readSessionValue(SECRET, value, NOW)).toBeNull();
  });

  /**
   * SON KULLANMA İMZANIN İÇİNDE. Yalnızca `Max-Age` alanında olsaydı çerezi
   * saklayan biri süresiz kullanırdı.
   */
  it("kullanıcı kimliği DEĞİŞTİRİLEMEZ", async () => {
    const value = await createSessionValue(SECRET, "kullanici-1", NOW);
    const kurcalanmis = value.replace("kullanici-1", "kullanici-2");

    expect(await readSessionValue(SECRET, kurcalanmis, NOW)).toBeNull();
  });

  it("süre UZATILAMAZ", async () => {
    const value = await createSessionValue(SECRET, "kullanici-1", NOW);
    const [id, sure, imza] = value.split(".");
    const uzatilmis = `${id}.${Number(sure) + 10_000_000}.${imza}`;

    expect(await readSessionValue(SECRET, uzatilmis, NOW)).toBeNull();
  });

  it("süresi dolmuş oturum reddedilir", async () => {
    const value = await createSessionValue(SECRET, "kullanici-1", NOW);
    const sonra = new Date(
      NOW.getTime() + (SESSION_MAX_AGE_SECONDS + 1) * 1_000,
    );

    expect(await readSessionValue(SECRET, value, sonra)).toBeNull();
  });

  it("çerez yoksa null — hata değil", async () => {
    expect(await readSessionValue(SECRET, undefined, NOW)).toBeNull();
  });

  it("bozuk biçim reddedilir", async () => {
    for (const bozuk of ["", "tek", "a.b", "a.b.c.d"]) {
      expect(await readSessionValue(SECRET, bozuk, NOW)).toBeNull();
    }
  });
});

describe("bekleyen kayıt çerezi", () => {
  it("sub ÖZETİNİ taşır ve geri verir", async () => {
    const ozet = await hashSubject(SECRET, "google-sub-123");
    const value = await createPendingValue(SECRET, ozet, NOW);

    expect(await readPendingValue(SECRET, value, NOW)).toBe(ozet);
  });

  it("KISA ömürlüdür — yarım kalan giriş günler sonra tamamlanamaz", async () => {
    const value = await createPendingValue(SECRET, "ozet", NOW);
    const birSaatSonra = new Date(NOW.getTime() + 60 * 60 * 1_000);

    expect(await readPendingValue(SECRET, value, birSaatSonra)).toBeNull();
  });
});

/**
 * Jeton takası — PROJECT.md §11.10, §6.3.
 *
 * BU İŞLEV TEST EDİLMEMİŞTİ ve bedeli üretimde ödendi: giriş "Google ile
 * bağlantı kurulamadı" ile düştüğünde sebebi Vercel günlüğünden bile
 * okunamıyordu, çünkü hiçbir yere yazılmıyordu. §6.3'ün kuralı "ayrıntı LOGA,
 * kimlik YANITA" — yanıt tarafı doğruydu, log tarafı eksikti.
 *
 * Testler iki şeyi birlikte tutuyor: çağırana dönen sebep DARALTILMIŞ kalmalı
 * (kullanıcıya sızmasın), günlüğe düşen sebep ise AYRINTILI olmalı.
 */
describe("Google jeton takası", () => {
  const GIRDI = {
    code: "kod",
    codeVerifier: "dogrulayici",
    clientId: "istemci",
    clientSecret: "sir",
    redirectUri: "https://ornek.test/api/auth/callback/google",
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function yakalaHatalari(): { satirlar: string[] } {
    const satirlar: string[] = [];
    vi.spyOn(console, "error").mockImplementation((line: unknown) => {
      satirlar.push(String(line));
    });
    return { satirlar };
  }

  it("başarılı yanıttan id_token'ı okur", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id_token: "jeton", access_token: "e" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(exchangeCode(GIRDI)).resolves.toEqual({
      ok: true,
      idToken: "jeton",
    });
  });

  it("Google reddederse sebebi GÜNLÜĞE yazar, yanıta değil", async () => {
    const { satirlar } = yakalaHatalari();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "invalid_client",
            error_description: "Unauthorized",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const sonuc = await exchangeCode(GIRDI);

    // Çağırana dönen sebep DAR: hangi parçanın yanlış olduğunu söylemiyor.
    expect(sonuc).toEqual({ ok: false, reason: "reddedildi" });

    // Günlükte ise teşhisin tamamı var.
    expect(satirlar).toHaveLength(1);
    const kayit: unknown = JSON.parse(satirlar[0] ?? "{}");
    expect(kayit).toMatchObject({
      level: "error",
      googleError: "invalid_client",
      googleDescription: "Unauthorized",
      status: 401,
    });
  });

  it("gizli anahtar GÜNLÜĞE SIZMAZ", async () => {
    const { satirlar } = yakalaHatalari();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 400,
        }),
      ),
    );

    await exchangeCode(GIRDI);

    expect(satirlar.join("\n")).not.toContain(GIRDI.clientSecret);
    expect(satirlar.join("\n")).not.toContain(GIRDI.code);
  });

  it("ağ hatasında 'ulasilamadi' döner ve hatayı günlüğe yazar", async () => {
    const { satirlar } = yakalaHatalari();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("bağlanılamadı")),
    );

    await expect(exchangeCode(GIRDI)).resolves.toEqual({
      ok: false,
      reason: "ulasilamadi",
    });
    expect(satirlar.join("\n")).toContain("ulaşılamadı");
  });

  it("id_token yoksa reddeder ve günlüğe yazar", async () => {
    const { satirlar } = yakalaHatalari();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ access_token: "yalnizca-bu" }), {
          status: 200,
        }),
      ),
    );

    await expect(exchangeCode(GIRDI)).resolves.toEqual({
      ok: false,
      reason: "reddedildi",
    });
    expect(satirlar.join("\n")).toContain("id_token");
  });
});
