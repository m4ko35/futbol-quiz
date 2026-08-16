import { describeError, log } from "../logger";
import { GOOGLE_TOKEN_URL } from "./oidc";

/**
 * Google jeton takası — PROJECT.md §11.10, §7.4.
 *
 * BU, İSTEK YOLUNDAN AĞA ÇIKAN TEK YER (Turso dışında). Adres kodda sabit
 * (`GOOGLE_TOKEN_URL`), kullanıcı girdisinden türetilmiyor ve yönlendirme
 * takip edilmiyor — §7.4'ün izin verdiği biçim tam olarak bu.
 */

export interface TokenExchange {
  readonly code: string;
  readonly codeVerifier: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export type TokenExchangeResult =
  | { readonly ok: true; readonly idToken: string }
  | { readonly ok: false; readonly reason: "reddedildi" | "ulasilamadi" };

/**
 * Zaman aşımı — 10 saniye.
 *
 * Sınırsız beklemek, Google yavaşladığında sunucusuz işlevi bekletir ve
 * kullanıcıya dönen tek şey zaman aşımı olur. Sınırlı bekleme en azından
 * anlaşılır bir hata üretir.
 */
const TIMEOUT_MS = 10_000;

/** Log satirlarinda hangi akisin konusuldugunu belirtir. */
const ROUTE = "/api/auth/callback/google";

/**
 * Yetkilendirme kodunu kimlik jetonuna çevirir.
 *
 * DÖNEN JETON DOĞRUDAN BU YANITTAN OKUNUR ve BR-51'in dayanağı budur: jeton
 * güvenilmeyen bir yoldan gelmediği için imzası ayrıca doğrulanmıyor. Bu
 * işlevin dönüşü başka hiçbir kaynakla karıştırılmamalıdır.
 *
 * `access_token` ve `refresh_token` OKUNMUYOR bile (BR-52): saklanmayan sır
 * sızmaz. Girişten sonra Google'a bir daha çağrı yapılmıyor.
 */
export async function exchangeCode(
  input: TokenExchange,
): Promise<TokenExchangeResult> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    code_verifier: input.codeVerifier,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
  });

  let response: Response;
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      // Yönlendirme TAKİP EDİLMEZ (§7.4): jeton ucu yönlendirmez ve
      // yönlendirirse bu, konuştuğumuz şeyin Google olmadığı anlamına gelir.
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error: unknown) {
    // Ağ hatası, zaman aşımı ya da beklenmedik yönlendirme. Sebebi ÇAĞIRANA
    // AYIRT ETTİRMİYORUZ: üçü de kullanıcı için aynı sonucu doğuruyor ve
    // ayrıntısı yanıta sızmamalı (§6.3).
    //
    // AMA LOGA YAZILIR. §6.3'ün kuralı "ayrıntı loga, kimlik yanıta" — burada
    // ayrıntı hiçbir yere yazılmıyordu ve sonucu üretimde ölçüldü: giriş
    // başarısız olduğunda sebebi Vercel günlüğünden bile okunamıyordu, geriye
    // yalnızca tahmin kalıyordu (§11.10).
    log("error", "Google jeton ucuna ulaşılamadı", {
      route: ROUTE,
      // İÇ İÇE, YAYILMIŞ DEĞİL: `describeError` bir `message` alanı döndürüyor
      // ve düz yayıldığında log satırının kendi mesajını EZİYORDU. Bir test
      // yakaladı; `api-handler.ts` de aynı sebeple `detail` altına koyuyor.
      detail: describeError(error),
    });
    return { ok: false, reason: "ulasilamadi" };
  }

  if (!response.ok) {
    /**
     * GOOGLE'IN HATA KODU SIR DEĞİL ve teşhisin tamamı odur:
     *
     *   invalid_client        → istemci kimliği/gizli anahtarı yanlış
     *   redirect_uri_mismatch → adres Google Console'da kayıtlı değil
     *   invalid_grant         → kod ya da PKCE doğrulayıcısı uyuşmuyor
     *
     * Gövde YALNIZCA bu dalda okunuyor; başarı yolunda jeton için gerekli.
     */
    const detail: unknown = await response.json().catch(() => null);
    const body =
      typeof detail === "object" && detail !== null
        ? (detail as Record<string, unknown>)
        : {};

    log("error", "Google jeton takası reddedildi", {
      route: ROUTE,
      status: response.status,
      googleError: body.error,
      googleDescription: body.error_description,
    });

    return { ok: false, reason: "reddedildi" };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error: unknown) {
    log("error", "Google yanıtı JSON değil", {
      route: ROUTE,
      // İÇ İÇE, YAYILMIŞ DEĞİL: `describeError` bir `message` alanı döndürüyor
      // ve düz yayıldığında log satırının kendi mesajını EZİYORDU. Bir test
      // yakaladı; `api-handler.ts` de aynı sebeple `detail` altına koyuyor.
      detail: describeError(error),
    });
    return { ok: false, reason: "reddedildi" };
  }

  if (typeof payload !== "object" || payload === null) {
    log("error", "Google yanıtı nesne değil", { route: ROUTE });
    return { ok: false, reason: "reddedildi" };
  }

  const idToken = (payload as Record<string, unknown>).id_token;
  if (typeof idToken !== "string" || idToken.length === 0) {
    // Jetonun KENDİSİ loglanmaz; yokluğu loglanır.
    log("error", "Google yanıtında id_token yok", { route: ROUTE });
    return { ok: false, reason: "reddedildi" };
  }

  return { ok: true, idToken };
}
