/**
 * Google OIDC — yetkilendirme isteği ve kimlik jetonu denetimi (§11.10).
 *
 * Bu dosya AĞA ÇIKMAZ: adres kurar, yanıt ayrıştırır, iddiaları denetler.
 * Google'la konuşan tek yer `google.ts`.
 */

/**
 * Google'ın uçları — KODDA SABİT (§7.4).
 *
 * Adres bir yapılandırma değeri DEĞİL: yapılandırmadan gelseydi, o
 * yapılandırmayı etkileyebilen herkes bizi istediği sunucuya konuşturabilirdi
 * ve kural tam olarak bunu yasaklıyor. Google'ın keşif belgesini (`.well-known`)
 * çekmek de aynı sebeple yapılmıyor — bir uç daha, bir ağ turu daha.
 */
export const GOOGLE_AUTHORIZE_URL =
  "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Kabul edilen `iss` değerleri.
 *
 * Google tarihsel olarak iki biçim döndürür ve ikisi de meşrudur; listeyi
 * daraltmak çalışan girişleri kırardı.
 */
const VALID_ISSUERS = new Set([
  "https://accounts.google.com",
  "accounts.google.com",
]);

/**
 * İSTENEN KAPSAM YALNIZCA `openid`.
 *
 * `email` ve `profile` istenmiyor: istenmeyen veri "saklamıyoruz" sözüne
 * değil, elimize hiç geçmemesine dayanır (§11.3). Yan faydası, `openid`in
 * hassas kapsam sayılmaması — uygulama Google'ın doğrulama sürecine girmeden
 * yayına alınabiliyor.
 */
export const GOOGLE_SCOPE = "openid";

export interface AuthorizationRequest {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly nonce: string;
  readonly codeChallenge: string;
}

export function authorizationUrl(request: AuthorizationRequest): string {
  const url = new URL(GOOGLE_AUTHORIZE_URL);

  url.searchParams.set("client_id", request.clientId);
  url.searchParams.set("redirect_uri", request.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPE);
  url.searchParams.set("state", request.state);
  url.searchParams.set("nonce", request.nonce);
  url.searchParams.set("code_challenge", request.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return url.toString();
}

/** Kimlik jetonunun bizi ilgilendiren iddiaları. */
export interface IdTokenClaims {
  readonly iss: string;
  readonly aud: string;
  readonly sub: string;
  readonly exp: number;
  readonly nonce?: string;
}

/**
 * Jetonun GÖVDESİNİ okur — imza DOĞRULANMAZ.
 *
 * Sebep BR-51'de yazılı: jeton bize Google'ın jeton ucundan doğrudan TLS
 * bağlantısıyla geliyor, yani kimden geldiği TLS'in kendisiyle kanıtlı. İmza,
 * jetonun GÜVENİLMEYEN bir yoldan geldiği durumlar içindir.
 *
 * MUAFİYET TEK BİR KOŞULA BAĞLI: bu işlev yalnızca jeton ucundan gelen
 * yanıtla çağrılmalıdır. İstemciden gelen bir jetona uygulanırsa imzasız bir
 * iddiayı kabul etmiş oluruz — doğrudan hesap ele geçirme.
 */
export function readIdTokenClaims(idToken: string): IdTokenClaims | null {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;

  const payload = parts[1];
  if (payload === undefined) return null;

  let decoded: unknown;
  try {
    const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    decoded = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)),
      ),
    );
  } catch {
    return null;
  }

  if (typeof decoded !== "object" || decoded === null) return null;

  const claims = decoded as Record<string, unknown>;
  if (
    typeof claims.iss !== "string" ||
    typeof claims.aud !== "string" ||
    typeof claims.sub !== "string" ||
    typeof claims.exp !== "number"
  ) {
    return null;
  }

  return {
    iss: claims.iss,
    aud: claims.aud,
    sub: claims.sub,
    exp: claims.exp,
    ...(typeof claims.nonce === "string" ? { nonce: claims.nonce } : {}),
  };
}

export type IdTokenRejection =
  | "bicimsiz"
  | "yanlis-issuer"
  | "yanlis-audience"
  | "suresi-gecmis"
  | "nonce-uyusmuyor";

export type IdTokenResult =
  | { readonly ok: true; readonly subject: string }
  | { readonly ok: false; readonly reason: IdTokenRejection };

export interface IdTokenCheck {
  readonly idToken: string;
  readonly clientId: string;
  readonly nonce: string;
  readonly now: Date;
}

/**
 * DÖRT DENETİM ve dördü de zorunlu (§11.10).
 *
 * `aud` EN KRİTİĞİ: denetlenmezse BAŞKA bir Google uygulaması için üretilmiş
 * jeton kabul edilir. Saldırganın yapması gereken tek şey kendi uygulamasında
 * kurbanı oturum açtırıp jetonu bize sunmak olurdu — hesap ele geçirme.
 *
 * `nonce` TEKRAR OYNATMAYA karşı: daha önce kullanılmış bir jetonun yeniden
 * sunulmasını engeller. Değer çerezden gelir, yani saldırgan onu bilemez.
 *
 * `exp` süresi geçmiş jetonu, `iss` başka bir sağlayıcının jetonunu eler.
 */
export function checkIdToken(input: IdTokenCheck): IdTokenResult {
  const claims = readIdTokenClaims(input.idToken);
  if (claims === null) return { ok: false, reason: "bicimsiz" };

  if (!VALID_ISSUERS.has(claims.iss)) {
    return { ok: false, reason: "yanlis-issuer" };
  }

  if (claims.aud !== input.clientId) {
    return { ok: false, reason: "yanlis-audience" };
  }

  // `exp` saniye cinsinden; milisaniyeyle karşılaştırmak jetonu bin kat uzun
  // geçerli gösterirdi.
  if (claims.exp * 1_000 <= input.now.getTime()) {
    return { ok: false, reason: "suresi-gecmis" };
  }

  if (claims.nonce !== input.nonce) {
    return { ok: false, reason: "nonce-uyusmuyor" };
  }

  if (claims.sub.length === 0) return { ok: false, reason: "bicimsiz" };

  return { ok: true, subject: claims.sub };
}
