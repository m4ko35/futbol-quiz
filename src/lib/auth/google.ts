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
  } catch {
    // Ağ hatası, zaman aşımı ya da beklenmedik yönlendirme. Sebebi
    // AYIRT ETMİYORUZ: üçü de kullanıcı için aynı sonucu doğuruyor ve
    // ayrıntısı yanıta sızmamalı (§6.3).
    return { ok: false, reason: "ulasilamadi" };
  }

  if (!response.ok) return { ok: false, reason: "reddedildi" };

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, reason: "reddedildi" };
  }

  if (typeof payload !== "object" || payload === null) {
    return { ok: false, reason: "reddedildi" };
  }

  const idToken = (payload as Record<string, unknown>).id_token;
  if (typeof idToken !== "string" || idToken.length === 0) {
    return { ok: false, reason: "reddedildi" };
  }

  return { ok: true, idToken };
}
