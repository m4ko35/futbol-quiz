import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { accountsEnv, serverEnv } from "@/infrastructure/config/env";
import { accountsRepository } from "@/infrastructure/db/repositories";
import { exchangeCode } from "@/lib/auth/google";
import { checkIdToken } from "@/lib/auth/oidc";
import { hashSubject, timingSafeEqual } from "@/lib/auth/secrets";
import {
  createPendingValue,
  createSessionValue,
  FLOW_MAX_AGE_SECONDS,
  NONCE_COOKIE,
  PENDING_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  STATE_COOKIE,
  VERIFIER_COOKIE,
} from "@/lib/auth/session";
import { redirectUri } from "../../google/route";

/**
 * `GET /api/auth/callback/google` — giriş dönüşü (§11.10).
 *
 * SIRA KURALIN PARÇASI: önce `state`, sonra jeton takası, sonra jeton
 * denetimi. Takas önce yapılsaydı, saldırganın uydurduğu bir kodu Google'a
 * göndermiş olurduk — yani doğrulanmamış bir girdiyle ağa çıkardık.
 */

/** Kullanıcıya dönen tek hata biçimi (§6.3 — ayrıntı sızmaz). */
function fail(siteUrl: string, code: string): Response {
  const url = new URL("/giris", siteUrl);
  url.searchParams.set("hata", code);

  return new Response(null, {
    status: 303,
    headers: {
      Location: url.toString(),
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  const env = accountsEnv();
  if (env === null) return new Response("Bulunamadı", { status: 404 });

  const siteUrl = serverEnv().SITE_URL;
  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";

  const state = store.get(STATE_COOKIE)?.value;
  const nonce = store.get(NONCE_COOKIE)?.value;
  const verifier = store.get(VERIFIER_COOKIE)?.value;

  // Akışın ara çerezleri TEK KULLANIMLIK: sonuç ne olursa olsun silinir.
  // Kalsalardı aynı `state` ikinci bir dönüşte yeniden kullanılabilirdi.
  for (const name of [STATE_COOKIE, NONCE_COOKIE, VERIFIER_COOKIE]) {
    store.delete(name);
  }

  const returnedState = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");

  if (
    state === undefined ||
    nonce === undefined ||
    verifier === undefined ||
    returnedState === null ||
    !timingSafeEqual(state, returnedState)
  ) {
    // CSRF kapısı: dönüş bizim başlattığımız akışa ait değil.
    return fail(siteUrl, "akis");
  }

  // Kullanıcı Google ekranında "izin verme" dediyse `code` gelmez.
  if (code === null) return fail(siteUrl, "iptal");

  const exchanged = await exchangeCode({
    code,
    codeVerifier: verifier,
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
    redirectUri: redirectUri(siteUrl),
  });

  if (!exchanged.ok) return fail(siteUrl, "google");

  /**
   * BR-51 — jeton YALNIZCA yukarıdaki takasın yanıtından geliyor. İmzası bu
   * yüzden doğrulanmıyor; kalan dört denetim burada yapılıyor.
   */
  const checked = checkIdToken({
    idToken: exchanged.idToken,
    clientId: env.googleClientId,
    nonce,
    now: new Date(),
  });

  if (!checked.ok) return fail(siteUrl, "jeton");

  const subjectHash = await hashSubject(env.authSecret, checked.subject);

  const repository = accountsRepository();
  if (repository === null) return fail(siteUrl, "yapilandirma");

  const account = await repository.findBySubjectHash(subjectHash);

  /**
   * HESABI OLMAYAN KULLANICI AD SEÇMEYE GİDER (BR-46).
   *
   * Burada hesap AÇILMIYOR: adı kullanıcı seçecek ve Google'dan gelen gerçek
   * adı kullanmak, insanların gerçek isimlerini istemeden herkese açık bir
   * listeye yazmak olurdu.
   *
   * Oturum çerezi de VERİLMİYOR — hesapsız bir oturum, her çağıranın "peki ya
   * kullanıcı yoksa" durumunu ayrıca düşünmesini gerektirirdi. Ayrı ve kısa
   * ömürlü bir çerez o durumu tek yola hapsediyor.
   */
  if (account === null) {
    store.set(
      PENDING_COOKIE,
      await createPendingValue(env.authSecret, subjectHash, new Date()),
      {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: FLOW_MAX_AGE_SECONDS,
      },
    );

    return new Response(null, {
      status: 303,
      headers: {
        Location: new URL("/giris/ad", siteUrl).toString(),
        "Cache-Control": "private, no-store",
      },
    });
  }

  store.set(
    SESSION_COOKIE,
    await createSessionValue(env.authSecret, account.id, new Date()),
    {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  );

  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL("/istatistik", siteUrl).toString(),
      "Cache-Control": "private, no-store",
    },
  });
}
