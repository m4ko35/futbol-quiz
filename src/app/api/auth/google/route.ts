import { cookies } from "next/headers";
import { accountsEnv, serverEnv } from "@/infrastructure/config/env";
import { authorizationUrl } from "@/lib/auth/oidc";
import { pkceChallenge, randomToken } from "@/lib/auth/secrets";
import {
  FLOW_MAX_AGE_SECONDS,
  NONCE_COOKIE,
  STATE_COOKIE,
  VERIFIER_COOKIE,
} from "@/lib/auth/session";

/**
 * `GET /api/auth/google` — giriş akışını başlatır (§11.10).
 *
 * Üç değer üretilip ÇEREZE yazılıyor, sonra kullanıcı Google'a yönlendiriliyor:
 *
 *   state    — dönüşün bizim başlattığımız akışa ait olduğunu kanıtlar (CSRF)
 *   nonce    — kimlik jetonunun tekrar oynatılmasını engeller
 *   verifier — PKCE; kod çalınsa bile jetona çevrilemez
 *
 * ÜÇÜ DE ÇEREZDE, çünkü sunucu durumsuz. Sunucuda tutmak bir oturum deposu
 * gerektirirdi ve §11.10 tam da bundan kaçınıyor.
 */

/** Google Console'a girilen adresle BİREBİR aynı olmalı. */
export function redirectUri(siteUrl: string): string {
  return new URL("/api/auth/callback/google", siteUrl).toString();
}

export async function GET(): Promise<Response> {
  const env = accountsEnv();

  // Hesap özelliği kapalı: 404. `500` YANLIŞ OLURDU — yapılandırılmamış bir
  // özellik bir arıza değil (§11).
  if (env === null) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken();
  const challenge = await pkceChallenge(verifier);

  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";

  for (const [name, value] of [
    [STATE_COOKIE, state],
    [NONCE_COOKIE, nonce],
    [VERIFIER_COOKIE, verifier],
  ] as const) {
    store.set(name, value, {
      httpOnly: true,
      secure,
      // `lax` ZORUNLU, `strict` DEĞİL: Google'dan dönen istek çapraz sitedir
      // ve `strict` olsaydı tarayıcı çerezi göndermez, akış her seferinde
      // "state uyuşmuyor" ile düşerdi.
      sameSite: "lax",
      path: "/",
      maxAge: FLOW_MAX_AGE_SECONDS,
    });
  }

  const url = authorizationUrl({
    clientId: env.googleClientId,
    redirectUri: redirectUri(serverEnv().SITE_URL),
    state,
    nonce,
    codeChallenge: challenge,
  });

  // 303: tarayıcı sonraki isteği GET yapsın ve bu yanıt önbelleğe girmesin.
  return new Response(null, {
    status: 303,
    headers: { Location: url, "Cache-Control": "private, no-store" },
  });
}
